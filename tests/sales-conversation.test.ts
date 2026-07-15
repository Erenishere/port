import assert from "node:assert/strict";
import test from "node:test";
import { POST as postChat } from "../app/api/chat/route";
import {
  createSalesConversationManager,
  type LeadNotifier,
} from "../lib/sales/conversation";
import { InMemoryLeadRepository, resetLeadRepositoryForTests } from "../lib/sales/repository";

function createManager(notifier: LeadNotifier = async () => ({ ok: true, reference: "WN-2026-00001" })) {
  let knowledgeCalls = 0;
  const manager = createSalesConversationManager(
    new InMemoryLeadRepository(),
    async () => {
      knowledgeCalls += 1;
      return "Approved portfolio information.";
    },
    notifier,
  );
  return { manager, getKnowledgeCalls: () => knowledgeCalls };
}

test("qualifies an ERP lead without leaking an earlier AI topic", async () => {
  const { manager } = createManager();
  const sessionId = "erp-topic-switch";

  await manager.handleTurn(sessionId, "What AI work have you built?");
  const erp = await manager.handleTurn(sessionId, "Actually, I need an ERP for my warehouse.");

  assert.equal(erp.lead.projectType, "erp");
  assert.equal(erp.lead.businessGoal, "Manage warehouse operations");
  assert.ok(erp.lead.requestedFeatures.includes("warehouse management"));
  assert.ok(!erp.lead.requestedFeatures.some((feature) => /ai|chatbot/i.test(feature)));
  assert.equal(erp.lead.phase, "qualify");
  assert.equal(erp.lead.activeQuestionField, "usersAndRoles");
  assert.match(erp.answer, /Who will use it/i);
});

test("treats an ERP request after a portfolio question as a new sales direction", async () => {
  const { manager } = createManager();
  const sessionId = "erp-after-portfolio";

  await manager.handleTurn(sessionId, "Show me the featured ERP");
  const erp = await manager.handleTurn(sessionId, "I also want an ERP system for my business.");
  assert.equal(erp.lead.projectType, "erp");
  assert.equal(erp.lead.activeQuestionField, "businessGoal");
  assert.match(erp.answer, /main business problem/i);

  const aiEnabled = await manager.handleTurn(sessionId, "Yes, an ERP with AI.");
  assert.equal(aiEnabled.lead.projectType, "erp");
  assert.ok(aiEnabled.lead.requestedFeatures.includes("AI integration"));
});

test("understands natural qualification answers without repeating the same question", async () => {
  const { manager } = createManager();
  const sessionId = "natural-answers";

  const greeting = await manager.handleTurn(sessionId, "hi");
  assert.match(greeting.answer, /^Hi!/);

  await manager.handleTurn(sessionId, "I want an ERP system for my business.");
  await manager.handleTurn(sessionId, "Automate manual work.");
  const allUsers = await manager.handleTurn(sessionId, "all");
  assert.ok(allUsers.lead.usersAndRoles.includes("all user groups"));
  assert.equal(allUsers.lead.activeQuestionField, "requestedFeatures");

  const features = await manager.handleTurn(sessionId, "Invertory handling");
  assert.ok(features.lead.requestedFeatures.includes("inventory management"));
  assert.equal(features.lead.activeQuestionField, "currentSystem");

  const scratch = await manager.handleTurn(sessionId, "scratch");
  assert.equal(scratch.lead.currentSystem, "No existing system");
  assert.equal(scratch.lead.activeQuestionField, "integrations");

  const noIntegrations = await manager.handleTurn(sessionId, "no");
  assert.equal(noIntegrations.lead.activeQuestionField, "timelineText");
  assert.match(noIntegrations.answer, /What timeline/i);
});

test("accepts an unknown integration answer and advances the scope", async () => {
  const { manager } = createManager();
  const sessionId = "unknown-integration";
  for (const turn of [
    "I need an ERP for my warehouse.",
    "Warehouse staff will use it.",
    "We need inventory.",
    "Starting from scratch.",
  ]) {
    await manager.handleTurn(sessionId, turn);
  }

  const unknown = await manager.handleTurn(sessionId, "I dont know");
  assert.ok(unknown.lead.answeredFields.includes("integrations"));
  assert.equal(unknown.lead.activeQuestionField, "timelineText");
  assert.match(unknown.answer, /What timeline/i);
});

test("handles pricing as a sales question without retrieval", async () => {
  const { manager, getKnowledgeCalls } = createManager();
  const result = await manager.handleTurn("pricing", "I need an ERP for my warehouse.");
  const price = await manager.handleTurn("pricing", "What will it cost?");

  assert.equal(result.lead.projectType, "erp");
  assert.equal(getKnowledgeCalls(), 0);
  assert.match(price.answer, /cost depends on scope/i);
  assert.match(price.answer, /Who will use it/i);
});

test("maps active answers to lead fields and removes corrected features", async () => {
  const { manager } = createManager();
  const sessionId = "correction";

  await manager.handleTurn(sessionId, "I need an ERP for my warehouse.");
  await manager.handleTurn(sessionId, "Warehouse staff and managers will use it.");
  await manager.handleTurn(sessionId, "We need inventory, purchasing, sales, and reporting.");
  const corrected = await manager.handleTurn(sessionId, "We do not need reporting.");

  assert.ok(corrected.lead.requestedFeatures.includes("inventory management"));
  assert.ok(!corrected.lead.requestedFeatures.includes("reporting"));
  assert.equal(corrected.lead.activeQuestionField, "currentSystem");
});

test("captures contact details and submits only after explicit consent", async () => {
  const { manager } = createManager();
  const sessionId = "submission";
  const turns = [
    "I need an ERP for my warehouse.",
    "Warehouse staff and managers will use it.",
    "We need inventory, purchasing, and sales.",
    "We are starting from scratch.",
    "No integrations are needed.",
    "Within three months.",
    "The budget is not decided yet.",
    "Prepare a quote.",
    "Ahmed Khan",
    "ahmed@example.com",
  ];

  let result = await manager.handleTurn(sessionId, turns[0]);
  for (const turn of turns.slice(1)) result = await manager.handleTurn(sessionId, turn);

  assert.equal(result.lead.contact.name, "Ahmed Khan");
  assert.equal(result.lead.contact.email, "ahmed@example.com");
  assert.equal(result.lead.consentToSubmit, false);
  assert.equal(result.lead.status, "awaiting_contact");
  assert.equal(result.lead.activeQuestionField, "consent");

  const submitted = await manager.handleTurn(sessionId, "Yes, submit it.");
  assert.equal(submitted.lead.status, "submitted");
  assert.equal(submitted.lead.backendLeadReference, "WN-2026-00001");
  assert.match(submitted.answer, /submitted successfully/i);
});

test("reports submission delivery failure honestly", async () => {
  const { manager } = createManager(async () => ({ ok: false, error: "Delivery unavailable" }));
  const sessionId = "submission-failure";
  const turns = [
    "I need an ERP for my warehouse.",
    "Warehouse staff and managers will use it.",
    "We need inventory and sales.",
    "We are starting from scratch.",
    "No integrations are needed.",
    "Within three months.",
    "No budget is decided.",
    "Prepare a quote.",
    "Ahmed Khan",
    "ahmed@example.com",
  ];
  for (const turn of turns) await manager.handleTurn(sessionId, turn);

  const failed = await manager.handleTurn(sessionId, "Yes, submit it.");
  assert.equal(failed.lead.status, "submission_failed");
  assert.match(failed.answer, /could not be submitted/i);
  assert.doesNotMatch(failed.answer, /submitted successfully/i);
});

test("the public chat API creates a server-owned session cookie", async () => {
  resetLeadRepositoryForTests();
  const response = await postChat(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "I need an ERP for my warehouse." }),
    }),
  );

  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie ?? "", /webnexus_sales_session=/);
  const body = (await response.json()) as { mode: string; lead: { phase: string } };
  assert.equal(body.mode, "sales");
  assert.equal(body.lead.phase, "qualify");
});

test("the public chat API starts a fresh server session when requested", async () => {
  resetLeadRepositoryForTests();
  const first = await postChat(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "I need an ERP for my warehouse." }),
    }),
  );
  const firstCookie = first.headers.get("set-cookie")?.split(";")[0] ?? "";

  const restarted = await postChat(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: firstCookie },
      body: JSON.stringify({
        query: "I want an ERP system for my business.",
        start_new: true,
      }),
    }),
  );
  const secondCookie = restarted.headers.get("set-cookie")?.split(";")[0] ?? "";
  const body = (await restarted.json()) as {
    lead: { phase: string; active_question_field: string | null };
  };

  assert.notEqual(secondCookie, firstCookie);
  assert.equal(body.lead.phase, "discover");
  assert.equal(body.lead.active_question_field, "businessGoal");
});
