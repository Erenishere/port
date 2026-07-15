import type { LeadRecord } from "./lead";
import type { LeadNotifier } from "./notifications";
import type { LeadRepository, OutboxClaim } from "./repository";

export type DeliveryResult =
  | { ok: true; lead: LeadRecord | null; leadReference: string; providerMessageId: string }
  | { ok: false; lead: LeadRecord | null; error: string; retryScheduled: boolean };

export type OutboxWorkerOptions = {
  workerId?: string;
  leaseMs?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  now?: () => Date;
};

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export class NotificationOutboxWorker {
  private readonly workerId: string;
  private readonly leaseMs: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly now: () => Date;

  constructor(
    private readonly repository: LeadRepository,
    private readonly notifier: LeadNotifier,
    options: OutboxWorkerOptions = {},
  ) {
    this.workerId = options.workerId ?? `worker:${crypto.randomUUID()}`;
    this.leaseMs =
      options.leaseMs ?? positiveNumber(process.env.LEAD_OUTBOX_LEASE_MS, 30_000);
    this.baseDelayMs =
      options.baseDelayMs ?? positiveNumber(process.env.LEAD_OUTBOX_BASE_DELAY_MS, 1_000);
    this.maxDelayMs =
      options.maxDelayMs ?? positiveNumber(process.env.LEAD_OUTBOX_MAX_DELAY_MS, 60_000);
    this.now = options.now ?? (() => new Date());
  }

  async processOutbox(outboxId: string): Promise<DeliveryResult> {
    const claim = await this.repository.claimOutbox({
      outboxId,
      workerId: this.workerId,
      now: this.now(),
      leaseMs: this.leaseMs,
    });
    if (!claim) return this.existingResult(outboxId);
    return this.deliver(claim);
  }

  async processDue(limit = 25) {
    const results: DeliveryResult[] = [];
    for (let index = 0; index < limit; index += 1) {
      const claim = await this.repository.claimOutbox({
        workerId: this.workerId,
        now: this.now(),
        leaseMs: this.leaseMs,
      });
      if (!claim) break;
      results.push(await this.deliver(claim));
    }
    return results;
  }

  private async deliver(claim: OutboxClaim): Promise<DeliveryResult> {
    const result = await this.notifier(claim.lead, {
      idempotencyKey: claim.idempotencyKey,
      attemptId: claim.attemptId,
      leadReference: claim.leadReference,
    });
    if (result.ok) {
      const providerMessageId =
        "providerMessageId" in result ? result.providerMessageId : result.reference;
      const leadReference = result.reference ?? claim.leadReference;
      const lead = await this.repository.completeOutbox({
        outboxId: claim.outboxId,
        workerId: claim.leaseOwner,
        providerMessageId,
        leadReference,
      });
      if (!lead) {
        return {
          ok: false,
          lead: null,
          error: "Notification delivery was accepted but could not be finalized.",
          retryScheduled: true,
        };
      }
      return {
        ok: true,
        lead,
        leadReference,
        providerMessageId,
      };
    }
    const retryable = result.retryable ?? true;
    const delay = Math.min(
      this.maxDelayMs,
      this.baseDelayMs * 2 ** Math.max(0, claim.attempts - 1),
    );
    const lead = await this.repository.failOutbox({
      outboxId: claim.outboxId,
      workerId: claim.leaseOwner,
      failure: {
        retryable,
        errorCode: result.errorCode ?? "DELIVERY_FAILED",
        error: result.error,
        nextAttemptAt: new Date(this.now().getTime() + delay),
      },
    });
    return {
      ok: false,
      lead,
      error: result.error,
      retryScheduled: retryable && claim.attempts < claim.maxAttempts,
    };
  }

  private async existingResult(outboxId: string): Promise<DeliveryResult> {
    const state = await this.repository.getSubmissionState(outboxId);
    if (state?.outboxStatus === "delivered" && state.providerMessageId) {
      return {
        ok: true,
        lead: null,
        leadReference: state.leadReference,
        providerMessageId: state.providerMessageId,
      };
    }
    return {
      ok: false,
      lead: null,
      error: state?.lastError ?? "The quote request is pending notification delivery.",
      retryScheduled: state?.outboxStatus === "pending" || state?.outboxStatus === "retry",
    };
  }
}
