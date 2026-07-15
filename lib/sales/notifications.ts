import type { LeadRecord } from "./lead";

export type NotificationContext = {
  idempotencyKey: string;
  attemptId: string;
  leadReference: string;
};

export type NotificationResult =
  | {
      ok: true;
      providerMessageId: string;
      reference?: string;
    }
  | {
      ok: false;
      error: string;
      errorCode?: string;
      retryable?: boolean;
    };

export type LeadNotifier = (
  lead: LeadRecord,
  context?: NotificationContext,
) => Promise<NotificationResult | { ok: true; reference: string }>;

function transientStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function createWebhookNotifier(): LeadNotifier {
  return async (lead, context) => {
    const endpoint = (process.env.LEAD_WEBHOOK_URL ?? "").trim();
    if (!endpoint) {
      return {
        ok: false,
        error: "Lead notification is not configured.",
        errorCode: "NOT_CONFIGURED",
        retryable: false,
      };
    }
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(context ? { "Idempotency-Key": context.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          event: "lead.quote_requested",
          lead_reference: context?.leadReference ?? lead.backendLeadReference,
          lead,
        }),
        signal: AbortSignal.timeout(6_000),
      });
      if (!response.ok) {
        return {
          ok: false,
          error: "Lead notification service rejected the request.",
          errorCode: `HTTP_${response.status}`,
          retryable: transientStatus(response.status),
        };
      }
      const data = (await response.json().catch(() => ({}))) as {
        provider_message_id?: unknown;
        message_id?: unknown;
        reference?: unknown;
      };
      const suppliedId = [data.provider_message_id, data.message_id, data.reference].find(
        (value): value is string => typeof value === "string" && Boolean(value.trim()),
      );
      return {
        ok: true,
        providerMessageId:
          suppliedId ?? response.headers.get("x-request-id") ?? `accepted:${context?.attemptId ?? lead.id}`,
      };
    } catch {
      return {
        ok: false,
        error: "Lead notification service was unavailable.",
        errorCode: "PROVIDER_UNAVAILABLE",
        retryable: true,
      };
    }
  };
}

export class FakeNotificationProvider {
  readonly calls: Array<{ lead: LeadRecord; context?: NotificationContext }> = [];

  constructor(
    private readonly responses: Array<Awaited<ReturnType<LeadNotifier>>> = [
      { ok: true, providerMessageId: "fake-message-1" },
    ],
  ) {}

  readonly send: LeadNotifier = async (lead, context) => {
    this.calls.push({ lead: structuredClone(lead), context });
    return this.responses.shift() ?? { ok: true, providerMessageId: "fake-message-repeat" };
  };
}
