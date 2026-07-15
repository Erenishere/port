import assert from "node:assert/strict";
import test from "node:test";
import { createPrismaClient } from "../lib/database/prisma";
import {
  createSalesConversationManager,
  type LeadNotifier,
} from "../lib/sales/conversation";
import { markAnswered } from "../lib/sales/lead";
import { NotificationOutboxWorker } from "../lib/sales/outbox-worker";
import { PrismaLeadRepository } from "../lib/sales/prisma-repository";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required for PostgreSQL tests.");

process.env.LEAD_OUTBOX_BASE_DELAY_MS = "0";
process.env.LEAD_OUTBOX_LEASE_MS = "20";

const prisma = createPrismaClient(databaseUrl);
const repository = new PrismaLeadRepository(prisma);

function manager(notifier: LeadNotifier = async () => ({
  ok: true,
  providerMessageId: "provider-default",
})) {
  return createSalesConversationManager(
    repository,
    async () => "Approved portfolio information.",
    notifier,
  );
}

async function captureQualifiedLead(
  salesManager: ReturnType<typeof manager>,
  sessionId: string,
) {
  for (const turn of [
    "I need an ERP for my warehouse.",
    "Warehouse staff and managers.",
    "Inventory and sales.",
    "Starting from scratch.",
    "No integrations.",
    "Three months.",
    "No fixed budget.",
    "Prepare a quote.",
    "Ahmed Khan",
    "ahmed@example.com",
  ]) {
    await salesManager.handleTurn(sessionId, turn);
  }
}

async function prepareWithoutDelivery(sessionId: string) {
  const salesManager = manager();
  await captureQualifiedLead(salesManager, sessionId);
  return repository.transaction(sessionId, async (transaction) => {
    transaction.lead.consentToSubmit = true;
    transaction.lead.consentAt = new Date().toISOString();
    transaction.lead.status = "ready_to_submit";
    markAnswered(transaction.lead, "consent");
    transaction.lead.transcript.push({
      role: "user",
      content: "Yes, submit it.",
      createdAt: new Date().toISOString(),
    });
    return transaction.prepareSubmission();
  });
}

test.beforeEach(async () => {
  await prisma.chatSession.deleteMany();
});

test.after(async () => {
  await prisma.$disconnect();
});

test("session, active question, and ordered transcript survive repository reconstruction", async () => {
  const salesManager = manager();
  const sessionId = "postgres-restart";
  await salesManager.handleTurn(sessionId, "I need an ERP for my warehouse.");
  await salesManager.handleTurn(sessionId, "Warehouse staff will use it.");

  const reconstructedClient = createPrismaClient(databaseUrl);
  const reconstructed = new PrismaLeadRepository(reconstructedClient);
  const lead = await reconstructed.getBySession(sessionId);
  await reconstructedClient.$disconnect();

  assert.equal(lead?.projectType, "erp");
  assert.equal(lead?.activeQuestionField, "currentSystem");
  assert.deepEqual(
    lead?.transcript.map(({ role, content }) => [role, content]),
    [
      ["user", "I need an ERP for my warehouse."],
      ["assistant", lead?.transcript[1].content],
      ["user", "Warehouse staff will use it."],
      ["assistant", lead?.transcript[3].content],
    ],
  );
  assert.ok(
    lead?.transcript.every(
      (message, index, transcript) =>
        index === 0 || message.createdAt >= transcript[index - 1].createdAt,
    ),
  );
});

test("scope corrections remain durable after restart", async () => {
  const salesManager = manager();
  const sessionId = "postgres-correction";
  await salesManager.handleTurn(sessionId, "I need an ERP with AI for my warehouse.");
  await salesManager.handleTurn(sessionId, "Not AI, just a normal ERP.");

  const reconstructedClient = createPrismaClient(databaseUrl);
  const reconstructed = new PrismaLeadRepository(reconstructedClient);
  const lead = await reconstructed.getBySession(sessionId);
  await reconstructedClient.$disconnect();

  assert.equal(lead?.projectType, "erp");
  assert.ok(!lead?.requestedFeatures.includes("AI integration"));
  assert.ok(lead?.fieldChanges.some((change) => /removed: AI integration/i.test(change.value)));
});

test("database locking prevents lost updates across manager instances", async () => {
  const first = manager();
  const secondRepository = new PrismaLeadRepository(prisma);
  const second = createSalesConversationManager(
    secondRepository,
    async () => null,
    async () => ({ ok: true, providerMessageId: "provider-concurrent" }),
  );
  const sessionId = "postgres-concurrent";
  await first.handleTurn(sessionId, "I need an ERP for my warehouse.");

  const turns = await Promise.allSettled([
    first.handleTurn(sessionId, "Warehouse staff and managers."),
    second.handleTurn(sessionId, "Inventory and sales."),
  ]);
  assert.ok(turns.every((turn) => turn.status === "fulfilled"));
  const lead = await repository.getBySession(sessionId);
  assert.ok(lead?.usersAndRoles.includes("warehouse staff"));
  assert.ok(lead?.requestedFeatures.includes("inventory management"));
  assert.ok(lead?.requestedFeatures.includes("sales"));
  assert.equal(lead?.transcript.length, 6);
});

test("separate PostgreSQL sessions remain isolated", async () => {
  const salesManager = manager();
  await Promise.all([
    salesManager.handleTurn("postgres-erp", "I need an ERP for my warehouse."),
    salesManager.handleTurn("postgres-ai", "I need a chatbot trained on PDFs."),
  ]);
  const [erp, ai] = await Promise.all([
    repository.getBySession("postgres-erp"),
    repository.getBySession("postgres-ai"),
  ]);
  assert.equal(erp?.projectType, "erp");
  assert.equal(ai?.projectType, "ai_assistant");
  assert.ok(!erp?.dataSources.includes("documents/PDFs"));
});

test("a failed submission transaction rolls back consent, transcript, attempt, and outbox", async () => {
  const sessionId = "postgres-rollback";
  await captureQualifiedLead(manager(), sessionId);
  const before = await repository.getBySession(sessionId);

  await assert.rejects(
    repository.transaction(sessionId, async (transaction) => {
      transaction.lead.consentToSubmit = true;
      transaction.lead.consentAt = new Date().toISOString();
      markAnswered(transaction.lead, "consent");
      transaction.lead.transcript.push({
        role: "user",
        content: "Yes, submit it.",
        createdAt: new Date().toISOString(),
      });
      await transaction.prepareSubmission();
      throw new Error("injected transaction failure");
    }),
    /injected transaction failure/,
  );

  const after = await repository.getBySession(sessionId);
  assert.equal(after?.consentToSubmit, false);
  assert.equal(after?.transcript.length, before?.transcript.length);
  assert.equal(after?.submissionAttempts, 0);
  assert.equal(await prisma.submissionAttempt.count(), 0);
  assert.equal(await prisma.notificationOutbox.count(), 0);
  assert.ok(!after?.transcript.some((message) => /submitted successfully/i.test(message.content)));
});

test("consent remains mandatory for the durable submission endpoint", async () => {
  const salesManager = manager();
  const sessionId = "postgres-consent";
  await captureQualifiedLead(salesManager, sessionId);
  const result = await salesManager.submitLead(sessionId);

  assert.equal(result.ok, false);
  assert.equal(result.status, 422);
  assert.equal(await prisma.submissionAttempt.count(), 0);
  assert.equal(await prisma.notificationOutbox.count(), 0);
});

test("duplicate submissions reuse one attempt, one outbox event, and one lead reference", async () => {
  let calls = 0;
  const notifier: LeadNotifier = async () => {
    calls += 1;
    return {
      ok: true,
      providerMessageId: "provider-idempotent-1",
      reference: "WN-IDEMPOTENT-PG",
    };
  };
  const salesManager = manager(notifier);
  const sessionId = "postgres-idempotent";
  await captureQualifiedLead(salesManager, sessionId);
  const submitted = await salesManager.handleTurn(sessionId, "Yes, submit it.");
  const duplicate = await salesManager.submitLead(sessionId);

  assert.equal(submitted.lead.status, "submitted");
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.lead.backendLeadReference, submitted.lead.backendLeadReference);
  assert.equal(calls, 1);
  assert.equal(await prisma.lead.count(), 1);
  assert.equal(await prisma.submissionAttempt.count(), 1);
  assert.equal(await prisma.notificationOutbox.count(), 1);
  const outbox = await prisma.notificationOutbox.findFirstOrThrow();
  assert.equal(outbox.providerMessageId, "provider-idempotent-1");
});

test("notification failure preserves the lead and a new worker retries it after restart", async () => {
  const failing: LeadNotifier = async () => ({
    ok: false,
    error: "Provider timeout",
    errorCode: "TIMEOUT",
    retryable: true,
  });
  const sessionId = "postgres-retry-restart";
  const salesManager = manager(failing);
  await captureQualifiedLead(salesManager, sessionId);
  const failed = await salesManager.handleTurn(sessionId, "Yes, submit it.");

  assert.equal(failed.lead.status, "submission_failed");
  assert.doesNotMatch(failed.answer, /submitted successfully/i);
  assert.equal(await prisma.lead.count(), 1);
  assert.equal((await prisma.notificationOutbox.findFirstOrThrow()).status, "retry");

  const restartedClient = createPrismaClient(databaseUrl);
  const restartedRepository = new PrismaLeadRepository(restartedClient);
  const restartedWorker = new NotificationOutboxWorker(
    restartedRepository,
    async () => ({ ok: true, providerMessageId: "provider-after-restart" }),
    { baseDelayMs: 0 },
  );
  const recovered = await restartedWorker.processDue();
  const lead = await restartedRepository.getBySession(sessionId);
  const outbox = await restartedClient.notificationOutbox.findFirstOrThrow();
  await restartedClient.$disconnect();

  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].ok, true);
  assert.equal(lead?.status, "submitted");
  assert.equal(outbox.status, "delivered");
  assert.equal(outbox.providerMessageId, "provider-after-restart");
  assert.equal(await prisma.lead.count(), 1);
});

test("an expired claim is recovered after a worker crash", async () => {
  const prepared = await prepareWithoutDelivery("postgres-expired-lease");
  const claimedAt = new Date(Date.now() + 1_000);
  const claim = await repository.claimOutbox({
    outboxId: prepared.value.outboxId,
    workerId: "crashed-worker",
    now: claimedAt,
    leaseMs: 5,
  });
  assert.ok(claim);

  const recoveryWorker = new NotificationOutboxWorker(
    repository,
    async () => ({ ok: true, providerMessageId: "provider-after-claim-crash" }),
    { now: () => new Date(claimedAt.getTime() + 10) },
  );
  const result = await recoveryWorker.processOutbox(prepared.value.outboxId);
  assert.equal(result.ok, true);
  assert.equal((await prisma.notificationOutbox.findFirstOrThrow()).status, "delivered");
});

test("provider acceptance recovery reuses the same idempotency key", async () => {
  const prepared = await prepareWithoutDelivery("postgres-provider-acceptance");
  const keys: string[] = [];
  const accepted = new Set<string>();
  const provider: LeadNotifier = async (_lead, context) => {
    assert.ok(context);
    keys.push(context.idempotencyKey);
    if (!accepted.has(context.idempotencyKey)) {
      accepted.add(context.idempotencyKey);
      throw new Error("worker crashed after provider acceptance");
    }
    return { ok: true, providerMessageId: "provider-accepted-once" };
  };

  const firstAttemptAt = new Date(Date.now() + 1_000);
  const firstWorker = new NotificationOutboxWorker(repository, provider, {
    leaseMs: 5,
    now: () => firstAttemptAt,
  });
  await assert.rejects(
    firstWorker.processOutbox(prepared.value.outboxId),
    /worker crashed after provider acceptance/,
  );
  assert.equal((await prisma.notificationOutbox.findFirstOrThrow()).status, "processing");
  const restartedWorker = new NotificationOutboxWorker(repository, provider, {
    now: () => new Date(firstAttemptAt.getTime() + 10),
  });
  const second = await restartedWorker.processOutbox(prepared.value.outboxId);

  assert.equal(second.ok, true);
  assert.equal(accepted.size, 1);
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
  const outbox = await prisma.notificationOutbox.findFirstOrThrow();
  assert.equal(outbox.providerMessageId, "provider-accepted-once");
  assert.equal(await prisma.lead.count(), 1);
});
