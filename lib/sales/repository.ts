import {
  createLead,
  isLeadEligibleForSubmission,
  type LeadRecord,
} from "./lead";
import { PrismaLeadRepository } from "./prisma-repository";

export type PreparedSubmission = {
  attemptId: string;
  outboxId: string;
  idempotencyKey: string;
  leadReference: string;
  existing: boolean;
};

export type SubmissionState = PreparedSubmission & {
  attemptStatus: string;
  outboxStatus: string;
  providerMessageId: string | null;
  lastError: string | null;
};

export type OutboxClaim = {
  outboxId: string;
  attemptId: string;
  idempotencyKey: string;
  leadReference: string;
  lead: LeadRecord;
  attempts: number;
  maxAttempts: number;
  leaseOwner: string;
};

export type OutboxFailure = {
  retryable: boolean;
  errorCode: string;
  error: string;
  nextAttemptAt: Date;
};

export interface LeadTransaction {
  lead: LeadRecord;
  prepareSubmission(): Promise<PreparedSubmission>;
}

export interface LeadRepository {
  getOrCreate(sessionId: string): Promise<LeadRecord>;
  getBySession(sessionId: string): Promise<LeadRecord | null>;
  save(lead: LeadRecord, expectedVersion: number): Promise<LeadRecord>;
  transaction<T>(
    sessionId: string,
    operation: (transaction: LeadTransaction) => Promise<T>,
  ): Promise<{ value: T; lead: LeadRecord }>;
  claimOutbox(input: {
    outboxId?: string;
    workerId: string;
    now: Date;
    leaseMs: number;
  }): Promise<OutboxClaim | null>;
  completeOutbox(input: {
    outboxId: string;
    workerId: string;
    providerMessageId: string;
    leadReference?: string;
  }): Promise<LeadRecord | null>;
  failOutbox(input: {
    outboxId: string;
    workerId: string;
    failure: OutboxFailure;
  }): Promise<LeadRecord | null>;
  getSubmissionState(outboxId: string): Promise<SubmissionState | null>;
}

export class ConcurrentLeadUpdateError extends Error {}
export class SubmissionEligibilityError extends Error {}

type MemoryAttempt = {
  id: string;
  leadId: string;
  idempotencyKey: string;
  leadReference: string;
  status: string;
  deliveryAttempts: number;
  providerMessageId: string | null;
  lastError: string | null;
};

type MemoryOutbox = {
  id: string;
  attemptId: string;
  idempotencyKey: string;
  status: string;
  payload: LeadRecord;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  providerMessageId: string | null;
  lastError: string | null;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function maxOutboxAttempts() {
  const parsed = Number(process.env.LEAD_OUTBOX_MAX_ATTEMPTS ?? 5);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 5;
}

function leadReference(lead: LeadRecord) {
  return `WN-${new Date().getUTCFullYear()}-${lead.id.replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

export class InMemoryLeadRepository implements LeadRepository {
  private readonly leads = new Map<string, LeadRecord>();
  private readonly attempts = new Map<string, MemoryAttempt>();
  private readonly outbox = new Map<string, MemoryOutbox>();
  private readonly sessionQueues = new Map<string, Promise<void>>();

  async getOrCreate(sessionId: string) {
    return this.withSessionLock(sessionId, async () => {
      const existing = this.leads.get(sessionId);
      if (existing) return clone(existing);
      const lead = createLead(sessionId);
      this.leads.set(sessionId, clone(lead));
      return clone(lead);
    });
  }

  async getBySession(sessionId: string) {
    const lead = this.leads.get(sessionId);
    return lead ? clone(lead) : null;
  }

  async save(lead: LeadRecord, expectedVersion: number) {
    return this.withSessionLock(lead.sessionId, async () => {
      const current = this.leads.get(lead.sessionId);
      if (!current || current.version !== expectedVersion) {
        throw new ConcurrentLeadUpdateError("The lead changed before it could be saved.");
      }
      const saved = this.nextVersion(lead, expectedVersion);
      this.leads.set(lead.sessionId, clone(saved));
      return clone(saved);
    });
  }

  async transaction<T>(
    sessionId: string,
    operation: (transaction: LeadTransaction) => Promise<T>,
  ) {
    return this.withSessionLock(sessionId, async () => {
      const current = this.leads.get(sessionId) ?? createLead(sessionId);
      const working = clone(current);
      const stagedAttempts: MemoryAttempt[] = [];
      const stagedOutboxEvents: MemoryOutbox[] = [];
      const context: LeadTransaction = {
        lead: working,
        prepareSubmission: async () => {
          if (!isLeadEligibleForSubmission(working)) {
            throw new SubmissionEligibilityError(
              "The project scope, contact details, or explicit consent are incomplete.",
            );
          }
          const idempotencyKey = `lead:${working.id}:quote-request:v1`;
          const existingAttempt = [...this.attempts.values()].find(
            (attempt) => attempt.idempotencyKey === idempotencyKey,
          );
          if (existingAttempt) {
            const existingOutbox = [...this.outbox.values()].find(
              (event) => event.attemptId === existingAttempt.id,
            );
            if (!existingOutbox) throw new Error("Submission outbox event is missing.");
            return {
              attemptId: existingAttempt.id,
              outboxId: existingOutbox.id,
              idempotencyKey,
              leadReference: existingAttempt.leadReference,
              existing: true,
            };
          }
          const attemptId = crypto.randomUUID();
          const outboxId = crypto.randomUUID();
          const reference = leadReference(working);
          working.submissionAttempts += 1;
          working.backendLeadReference = reference;
          working.submissionError = null;
          stagedAttempts.push({
            id: attemptId,
            leadId: working.id,
            idempotencyKey,
            leadReference: reference,
            status: "pending",
            deliveryAttempts: 0,
            providerMessageId: null,
            lastError: null,
          });
          stagedOutboxEvents.push({
            id: outboxId,
            attemptId,
            idempotencyKey,
            status: "pending",
            payload: clone(working),
            attempts: 0,
            maxAttempts: maxOutboxAttempts(),
            nextAttemptAt: new Date(),
            leaseOwner: null,
            leaseExpiresAt: null,
            providerMessageId: null,
            lastError: null,
          });
          return { attemptId, outboxId, idempotencyKey, leadReference: reference, existing: false };
        },
      };
      const value = await operation(context);
      const saved = this.nextVersion(working, current.version);
      this.leads.set(sessionId, clone(saved));
      for (const attempt of stagedAttempts) this.attempts.set(attempt.id, clone(attempt));
      for (const event of stagedOutboxEvents) this.outbox.set(event.id, clone(event));
      return { value, lead: clone(saved) };
    });
  }

  async claimOutbox(input: {
    outboxId?: string;
    workerId: string;
    now: Date;
    leaseMs: number;
  }) {
    for (const candidate of this.outbox.values()) {
      if (
        candidate.status === "processing" &&
        candidate.leaseExpiresAt &&
        candidate.leaseExpiresAt <= input.now &&
        candidate.attempts >= candidate.maxAttempts
      ) {
        candidate.status = "dead";
        candidate.leaseOwner = null;
        candidate.leaseExpiresAt = null;
        candidate.lastError = "Notification delivery attempts were exhausted.";
        const attempt = this.attempts.get(candidate.attemptId);
        if (attempt) {
          attempt.status = "permanent_failure";
          attempt.lastError = candidate.lastError;
          const lead = [...this.leads.values()].find((item) => item.id === attempt.leadId);
          if (lead) {
            lead.status = "submission_failed";
            lead.submissionError = candidate.lastError;
          }
        }
      }
    }
    const event = [...this.outbox.values()]
      .filter((candidate) => !input.outboxId || candidate.id === input.outboxId)
      .filter(
        (candidate) =>
          ((candidate.status === "pending" || candidate.status === "retry") &&
            candidate.nextAttemptAt <= input.now) ||
          (candidate.status === "processing" &&
            candidate.attempts < candidate.maxAttempts &&
            Boolean(candidate.leaseExpiresAt && candidate.leaseExpiresAt <= input.now)),
      )
      .sort((left, right) => left.nextAttemptAt.getTime() - right.nextAttemptAt.getTime())[0];
    if (!event) return null;
    event.status = "processing";
    event.attempts += 1;
    event.leaseOwner = input.workerId;
    event.leaseExpiresAt = new Date(input.now.getTime() + input.leaseMs);
    const attempt = this.attempts.get(event.attemptId);
    if (!attempt) throw new Error("Submission attempt is missing.");
    attempt.deliveryAttempts += 1;
    return {
      outboxId: event.id,
      attemptId: attempt.id,
      idempotencyKey: event.idempotencyKey,
      leadReference: attempt.leadReference,
      lead: clone(event.payload),
      attempts: event.attempts,
      maxAttempts: event.maxAttempts,
      leaseOwner: input.workerId,
    };
  }

  async completeOutbox(input: {
    outboxId: string;
    workerId: string;
    providerMessageId: string;
    leadReference?: string;
  }) {
    const event = this.outbox.get(input.outboxId);
    if (!event) return null;
    const attempt = this.attempts.get(event.attemptId);
    if (!attempt) return null;
    const lead = [...this.leads.values()].find((candidate) => candidate.id === attempt.leadId);
    if (!lead) return null;
    if (event.status === "delivered") return clone(lead);
    if (event.status !== "processing" || event.leaseOwner !== input.workerId) return null;
    event.status = "delivered";
    event.providerMessageId = input.providerMessageId;
    event.leaseOwner = null;
    event.leaseExpiresAt = null;
    attempt.status = "delivered";
    attempt.providerMessageId = input.providerMessageId;
    if (input.leadReference) attempt.leadReference = input.leadReference;
    lead.status = "submitted";
    lead.phase = "submitted";
    lead.activeQuestionField = null;
    lead.submissionError = null;
    lead.backendLeadReference = input.leadReference ?? attempt.leadReference;
    lead.submittedAt = new Date().toISOString();
    lead.updatedAt = new Date().toISOString();
    lead.version += 1;
    return clone(lead);
  }

  async failOutbox(input: {
    outboxId: string;
    workerId: string;
    failure: OutboxFailure;
  }) {
    const event = this.outbox.get(input.outboxId);
    if (!event) return null;
    const attempt = this.attempts.get(event.attemptId);
    if (!attempt) return null;
    const lead = [...this.leads.values()].find((candidate) => candidate.id === attempt.leadId);
    if (!lead) return null;
    if (event.status !== "processing" || event.leaseOwner !== input.workerId) return null;
    const willRetry = input.failure.retryable && event.attempts < event.maxAttempts;
    event.status = willRetry ? "retry" : "dead";
    event.nextAttemptAt = input.failure.nextAttemptAt;
    event.lastError = input.failure.error;
    event.leaseOwner = null;
    event.leaseExpiresAt = null;
    attempt.status = willRetry ? "retry" : "permanent_failure";
    attempt.lastError = input.failure.error;
    lead.status = "submission_failed";
    lead.submissionError = input.failure.error;
    lead.updatedAt = new Date().toISOString();
    lead.version += 1;
    return clone(lead);
  }

  async getSubmissionState(outboxId: string) {
    const event = this.outbox.get(outboxId);
    if (!event) return null;
    const attempt = this.attempts.get(event.attemptId);
    if (!attempt) return null;
    return {
      attemptId: attempt.id,
      outboxId: event.id,
      idempotencyKey: attempt.idempotencyKey,
      leadReference: attempt.leadReference,
      existing: true,
      attemptStatus: attempt.status,
      outboxStatus: event.status,
      providerMessageId: event.providerMessageId,
      lastError: event.lastError,
    };
  }

  reset() {
    this.leads.clear();
    this.attempts.clear();
    this.outbox.clear();
  }

  private nextVersion(lead: LeadRecord, version: number) {
    return {
      ...clone(lead),
      version: version + 1,
      updatedAt: new Date().toISOString(),
    };
  }

  private async withSessionLock<T>(sessionId: string, task: () => Promise<T>) {
    const previous = this.sessionQueues.get(sessionId) ?? Promise.resolve();
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => gate);
    this.sessionQueues.set(sessionId, tail);
    await previous;
    try {
      return await task();
    } finally {
      release();
      if (this.sessionQueues.get(sessionId) === tail) this.sessionQueues.delete(sessionId);
    }
  }
}

const memoryRepository = new InMemoryLeadRepository();
let prismaRepository: PrismaLeadRepository | null = null;

export function getLeadRepository(): LeadRepository {
  if (process.env.WEBNEXUS_USE_IN_MEMORY_REPOSITORY === "true") return memoryRepository;
  prismaRepository ??= new PrismaLeadRepository();
  return prismaRepository;
}

export function resetLeadRepositoryForTests() {
  memoryRepository.reset();
}
