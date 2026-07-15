import { getPrismaClient } from "@/lib/database/prisma";
import {
  Prisma,
  type PrismaClient,
} from "@/generated/prisma/client";
import {
  createLead,
  isLeadEligibleForSubmission,
  type FieldChange,
  type LeadField,
  type LeadRecord,
  type LeadStatus,
  type ProjectType,
  type SalesPhase,
} from "./lead";
import type {
  LeadRepository,
  LeadTransaction,
  OutboxClaim,
  OutboxFailure,
  PreparedSubmission,
  SubmissionState,
} from "./repository";

type SessionAggregate = Prisma.ChatSessionGetPayload<{
  include: { lead: true; messages: true };
}>;

function maxOutboxAttempts() {
  const parsed = Number(process.env.LEAD_OUTBOX_MAX_ATTEMPTS ?? 5);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 5;
}

function stableLeadReference(lead: LeadRecord) {
  return `WN-${new Date().getUTCFullYear()}-${lead.id.replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function fieldChanges(value: Prisma.JsonValue): FieldChange[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (change): change is FieldChange =>
      Boolean(
        change &&
          typeof change === "object" &&
          "field" in change &&
          "value" in change &&
          "source" in change &&
          "createdAt" in change,
      ),
  );
}

function toLeadRecord(aggregate: SessionAggregate): LeadRecord {
  if (!aggregate.lead) throw new Error("A chat session is missing its lead record.");
  const lead = aggregate.lead;
  return {
    id: lead.id,
    sessionId: aggregate.id,
    version: aggregate.version,
    phase: aggregate.salesPhase as SalesPhase,
    status: lead.status as LeadStatus,
    projectType: lead.projectType as ProjectType | null,
    businessGoal: lead.businessGoal,
    usersAndRoles: lead.usersAndRoles,
    requestedFeatures: lead.requestedFeatures,
    currentSystem: lead.currentSystem,
    currentSystemProblems: lead.currentSystemProblems,
    integrations: lead.integrations,
    dataSources: lead.dataSources,
    stackPreference: lead.stackPreference,
    budgetText: lead.budgetText,
    budgetMin: lead.budgetMin === null ? null : Number(lead.budgetMin),
    budgetMax: lead.budgetMax === null ? null : Number(lead.budgetMax),
    budgetCurrency: lead.budgetCurrency,
    timelineText: lead.timelineText,
    contact: {
      name: lead.contactName,
      email: lead.contactEmail,
      company: lead.contactCompany,
      phone: lead.contactPhone,
    },
    consentToSubmit: lead.consentToSubmit,
    consentAt: lead.consentAt?.toISOString() ?? null,
    activeQuestionField: aggregate.activeQuestionField as LeadField | null,
    answeredFields: lead.answeredFields as LeadField[],
    lastConfirmedSummary: lead.lastConfirmedSummary,
    transcript: aggregate.messages
      .toSorted((left, right) => left.sequence - right.sequence)
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      })),
    fieldChanges: fieldChanges(lead.fieldChanges),
    submissionAttempts: lead.submissionAttemptCount,
    backendLeadReference: lead.leadReference,
    submissionError: lead.submissionError,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    submittedAt: lead.submittedAt?.toISOString() ?? null,
  };
}

function leadData(lead: LeadRecord, updatedAt: Date) {
  return {
    status: lead.status,
    projectType: lead.projectType,
    businessGoal: lead.businessGoal,
    usersAndRoles: lead.usersAndRoles,
    requestedFeatures: lead.requestedFeatures,
    currentSystem: lead.currentSystem,
    currentSystemProblems: lead.currentSystemProblems,
    integrations: lead.integrations,
    dataSources: lead.dataSources,
    stackPreference: lead.stackPreference,
    budgetText: lead.budgetText,
    budgetMin: lead.budgetMin,
    budgetMax: lead.budgetMax,
    budgetCurrency: lead.budgetCurrency,
    timelineText: lead.timelineText,
    contactName: lead.contact.name,
    contactEmail: lead.contact.email,
    contactCompany: lead.contact.company,
    contactPhone: lead.contact.phone,
    consentToSubmit: lead.consentToSubmit,
    consentAt: lead.consentAt ? new Date(lead.consentAt) : null,
    answeredFields: lead.answeredFields,
    lastConfirmedSummary: lead.lastConfirmedSummary,
    fieldChanges: asJson(lead.fieldChanges),
    submissionAttemptCount: lead.submissionAttempts,
    leadReference: lead.backendLeadReference,
    submissionError: lead.submissionError,
    submittedAt: lead.submittedAt ? new Date(lead.submittedAt) : null,
    updatedAt,
  };
}

function isTransactionConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    cause?: { originalCode?: unknown; kind?: unknown };
  };
  return (
    candidate.code === "P2034" ||
    candidate.code === "40001" ||
    candidate.cause?.originalCode === "40001" ||
    candidate.cause?.kind === "TransactionWriteConflict"
  );
}

export class PrismaLeadRepository implements LeadRepository {
  constructor(private prismaClient?: PrismaClient) {}

  private get prisma() {
    this.prismaClient ??= getPrismaClient();
    return this.prismaClient;
  }

  async getOrCreate(sessionId: string) {
    return this.serializable(async (tx) => {
      const aggregate = await this.loadOrCreate(tx, sessionId);
      return toLeadRecord(aggregate);
    });
  }

  async getBySession(sessionId: string) {
    return this.serializable(async (tx) => {
      await this.lockSession(tx, sessionId);
      const aggregate = await this.findAggregate(tx, sessionId);
      return aggregate ? toLeadRecord(aggregate) : null;
    });
  }

  async save(lead: LeadRecord, expectedVersion: number) {
    return this.serializable(async (tx) => {
      const aggregate = await this.loadOrCreate(tx, lead.sessionId);
      if (aggregate.version !== expectedVersion) {
        throw new Error("The lead changed before it could be saved.");
      }
      return this.persistAggregate(tx, aggregate, lead);
    });
  }

  async transaction<T>(
    sessionId: string,
    operation: (transaction: LeadTransaction) => Promise<T>,
  ) {
    return this.serializable(async (tx) => {
      const aggregate = await this.loadOrCreate(tx, sessionId);
      const working = toLeadRecord(aggregate);
      const context: LeadTransaction = {
        lead: working,
        prepareSubmission: () => this.prepareSubmission(tx, working),
      };
      const value = await operation(context);
      const lead = await this.persistAggregate(tx, aggregate, working);
      return { value, lead };
    });
  }

  async claimOutbox(input: {
    outboxId?: string;
    workerId: string;
    now: Date;
    leaseMs: number;
  }): Promise<OutboxClaim | null> {
    return this.serializable(async (tx) => {
      const eligibility = {
        OR: [
          {
            status: { in: ["pending", "retry"] },
            nextAttemptAt: { lte: input.now },
          },
          {
            status: "processing",
            leaseExpiresAt: { lte: input.now },
          },
        ],
      } satisfies Prisma.NotificationOutboxWhereInput;
      const candidate = await tx.notificationOutbox.findFirst({
        where: {
          ...(input.outboxId ? { id: input.outboxId } : {}),
          ...eligibility,
        },
        orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      });
      if (!candidate) return null;
      if (candidate.attempts >= candidate.maxAttempts) {
        const now = new Date();
        const exhaustedError = "Notification delivery attempts were exhausted.";
        const attempt = await tx.submissionAttempt.update({
          where: { id: candidate.submissionAttemptId },
          data: {
            status: "permanent_failure",
            lastErrorCode: "ATTEMPTS_EXHAUSTED",
            lastError: exhaustedError,
            completedAt: now,
          },
        });
        await this.lockLead(tx, attempt.leadId);
        const lead = await tx.lead.update({
          where: { id: attempt.leadId },
          data: { status: "submission_failed", submissionError: exhaustedError },
        });
        await tx.chatSession.update({
          where: { id: lead.sessionId },
          data: { version: { increment: 1 }, updatedAt: now },
        });
        await tx.notificationOutbox.update({
          where: { id: candidate.id },
          data: {
            status: "dead",
            leaseOwner: null,
            leaseExpiresAt: null,
            lastErrorCode: "ATTEMPTS_EXHAUSTED",
            lastError: exhaustedError,
          },
        });
        return null;
      }
      const leaseExpiresAt = new Date(input.now.getTime() + input.leaseMs);
      const claimed = await tx.notificationOutbox.updateMany({
        where: { id: candidate.id, ...eligibility },
        data: {
          status: "processing",
          attempts: { increment: 1 },
          leaseOwner: input.workerId,
          leaseExpiresAt,
        },
      });
      if (claimed.count !== 1) throw Object.assign(new Error("Outbox claim conflict."), { code: "P2034" });
      const event = await tx.notificationOutbox.findUniqueOrThrow({
        where: { id: candidate.id },
        include: { submissionAttempt: true },
      });
      await tx.submissionAttempt.update({
        where: { id: event.submissionAttemptId },
        data: { deliveryAttempts: { increment: 1 }, status: "processing" },
      });
      return {
        outboxId: event.id,
        attemptId: event.submissionAttemptId,
        idempotencyKey: event.idempotencyKey,
        leadReference: event.submissionAttempt.leadReference,
        lead: event.payload as unknown as LeadRecord,
        attempts: event.attempts,
        maxAttempts: event.maxAttempts,
        leaseOwner: input.workerId,
      };
    });
  }

  async completeOutbox(input: {
    outboxId: string;
    workerId: string;
    providerMessageId: string;
    leadReference?: string;
  }) {
    return this.serializable(async (tx) => {
      const event = await tx.notificationOutbox.findUnique({
        where: { id: input.outboxId },
        include: { submissionAttempt: true },
      });
      if (!event) return null;
      await this.lockLead(tx, event.submissionAttempt.leadId);
      if (event.status !== "delivered") {
        if (event.status !== "processing" || event.leaseOwner !== input.workerId) return null;
        const now = new Date();
        await tx.notificationOutbox.update({
          where: { id: event.id },
          data: {
            status: "delivered",
            providerMessageId: input.providerMessageId,
            deliveredAt: now,
            leaseOwner: null,
            leaseExpiresAt: null,
            lastError: null,
            lastErrorCode: null,
          },
        });
        await tx.submissionAttempt.update({
          where: { id: event.submissionAttemptId },
          data: {
            status: "delivered",
            providerMessageId: input.providerMessageId,
            leadReference: input.leadReference ?? event.submissionAttempt.leadReference,
            completedAt: now,
            lastError: null,
            lastErrorCode: null,
          },
        });
        const lead = await tx.lead.update({
          where: { id: event.submissionAttempt.leadId },
          data: {
            status: "submitted",
            leadReference: input.leadReference ?? event.submissionAttempt.leadReference,
            submissionError: null,
            submittedAt: now,
            updatedAt: now,
          },
        });
        await tx.chatSession.update({
          where: { id: lead.sessionId },
          data: {
            salesPhase: "submitted",
            activeQuestionField: null,
            version: { increment: 1 },
            updatedAt: now,
          },
        });
      }
      const aggregate = await this.findAggregateByLead(tx, event.submissionAttempt.leadId);
      return aggregate ? toLeadRecord(aggregate) : null;
    });
  }

  async failOutbox(input: {
    outboxId: string;
    workerId: string;
    failure: OutboxFailure;
  }) {
    return this.serializable(async (tx) => {
      const event = await tx.notificationOutbox.findUnique({
        where: { id: input.outboxId },
        include: { submissionAttempt: true },
      });
      if (!event) return null;
      if (event.status !== "processing" || event.leaseOwner !== input.workerId) return null;
      await this.lockLead(tx, event.submissionAttempt.leadId);
      const willRetry = input.failure.retryable && event.attempts < event.maxAttempts;
      const now = new Date();
      await tx.notificationOutbox.update({
        where: { id: event.id },
        data: {
          status: willRetry ? "retry" : "dead",
          nextAttemptAt: input.failure.nextAttemptAt,
          leaseOwner: null,
          leaseExpiresAt: null,
          lastErrorCode: input.failure.errorCode,
          lastError: input.failure.error,
        },
      });
      await tx.submissionAttempt.update({
        where: { id: event.submissionAttemptId },
        data: {
          status: willRetry ? "retry" : "permanent_failure",
          lastErrorCode: input.failure.errorCode,
          lastError: input.failure.error,
          completedAt: willRetry ? null : now,
        },
      });
      const lead = await tx.lead.update({
        where: { id: event.submissionAttempt.leadId },
        data: {
          status: "submission_failed",
          submissionError: input.failure.error,
          updatedAt: now,
        },
      });
      await tx.chatSession.update({
        where: { id: lead.sessionId },
        data: { version: { increment: 1 }, updatedAt: now },
      });
      const aggregate = await this.findAggregateByLead(tx, event.submissionAttempt.leadId);
      return aggregate ? toLeadRecord(aggregate) : null;
    });
  }

  async getSubmissionState(outboxId: string): Promise<SubmissionState | null> {
    const event = await this.prisma.notificationOutbox.findUnique({
      where: { id: outboxId },
      include: { submissionAttempt: true },
    });
    if (!event) return null;
    return {
      attemptId: event.submissionAttemptId,
      outboxId: event.id,
      idempotencyKey: event.idempotencyKey,
      leadReference: event.submissionAttempt.leadReference,
      existing: true,
      attemptStatus: event.submissionAttempt.status,
      outboxStatus: event.status,
      providerMessageId: event.providerMessageId,
      lastError: event.lastError,
    };
  }

  private async prepareSubmission(
    tx: Prisma.TransactionClient,
    lead: LeadRecord,
  ): Promise<PreparedSubmission> {
    if (!isLeadEligibleForSubmission(lead)) {
      throw new Error("The project scope, contact details, or explicit consent are incomplete.");
    }
    const idempotencyKey = `lead:${lead.id}:quote-request:v1`;
    const existing = await tx.submissionAttempt.findUnique({
      where: { idempotencyKey },
      include: { outbox: true },
    });
    if (existing) {
      if (!existing.outbox) throw new Error("Submission outbox event is missing.");
      return {
        attemptId: existing.id,
        outboxId: existing.outbox.id,
        idempotencyKey,
        leadReference: existing.leadReference,
        existing: true,
      };
    }
    const reference = stableLeadReference(lead);
    lead.submissionAttempts += 1;
    lead.backendLeadReference = reference;
    lead.submissionError = null;
    const attempt = await tx.submissionAttempt.create({
      data: {
        leadId: lead.id,
        idempotencyKey,
        leadReference: reference,
        outbox: {
          create: {
            idempotencyKey: `outbox:${idempotencyKey}`,
            payload: asJson(lead),
            maxAttempts: maxOutboxAttempts(),
          },
        },
      },
      include: { outbox: true },
    });
    if (!attempt.outbox) throw new Error("Submission outbox event was not created.");
    return {
      attemptId: attempt.id,
      outboxId: attempt.outbox.id,
      idempotencyKey,
      leadReference: reference,
      existing: false,
    };
  }

  private async loadOrCreate(tx: Prisma.TransactionClient, sessionId: string) {
    await this.lockSession(tx, sessionId);
    const existing = await this.findAggregate(tx, sessionId);
    if (existing) return existing;
    const lead = createLead(sessionId);
    const createdAt = new Date(lead.createdAt);
    await tx.chatSession.create({
      data: {
        id: sessionId,
        version: lead.version,
        salesPhase: lead.phase,
        activeQuestionField: lead.activeQuestionField,
        createdAt,
        updatedAt: createdAt,
        lead: {
          create: {
            id: lead.id,
            ...leadData(lead, createdAt),
            createdAt,
          },
        },
      },
    });
    const created = await this.findAggregate(tx, sessionId);
    if (!created) throw new Error("The chat session could not be created.");
    return created;
  }

  private async persistAggregate(
    tx: Prisma.TransactionClient,
    aggregate: SessionAggregate,
    lead: LeadRecord,
  ) {
    if (!aggregate.lead) throw new Error("A chat session is missing its lead record.");
    if (lead.transcript.length < aggregate.messages.length) {
      throw new Error("Conversation messages are append-only.");
    }
    const ordered = aggregate.messages.toSorted((left, right) => left.sequence - right.sequence);
    const prefixMatches = ordered.every((message, index) => {
      const proposed = lead.transcript[index];
      return proposed?.role === message.role && proposed.content === message.content;
    });
    if (!prefixMatches) throw new Error("Persisted conversation history cannot be rewritten.");
    const now = new Date();
    const appended = lead.transcript.slice(ordered.length);
    if (appended.length) {
      await tx.conversationMessage.createMany({
        data: appended.map((message, index) => ({
          sessionId: lead.sessionId,
          sequence: ordered.length + index + 1,
          role: message.role,
          content: message.content,
          createdAt: new Date(message.createdAt),
        })),
      });
    }
    await tx.lead.update({
      where: { id: aggregate.lead.id },
      data: leadData(lead, now),
    });
    await tx.chatSession.update({
      where: { id: lead.sessionId },
      data: {
        salesPhase: lead.phase,
        activeQuestionField: lead.activeQuestionField,
        version: { increment: 1 },
        updatedAt: now,
      },
    });
    const saved = await this.findAggregate(tx, lead.sessionId);
    if (!saved) throw new Error("The chat session could not be reloaded.");
    return toLeadRecord(saved);
  }

  private findAggregate(tx: Prisma.TransactionClient, sessionId: string) {
    return tx.chatSession.findUnique({
      where: { id: sessionId },
      include: { lead: true, messages: { orderBy: { sequence: "asc" } } },
    });
  }

  private async findAggregateByLead(tx: Prisma.TransactionClient, leadId: string) {
    const lead = await tx.lead.findUnique({ where: { id: leadId }, select: { sessionId: true } });
    return lead ? this.findAggregate(tx, lead.sessionId) : null;
  }

  private async lockSession(tx: Prisma.TransactionClient, sessionId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${sessionId}, 0))`;
  }

  private async lockLead(tx: Prisma.TransactionClient, leadId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${leadId}, 0))`;
  }

  private async serializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 20_000,
        });
      } catch (error) {
        if (!isTransactionConflict(error) || attempt === 4) throw error;
      }
    }
    throw new Error("The database transaction could not be completed.");
  }
}
