import { createSalesConversationManager, createWebhookNotifier } from "@/lib/sales/conversation";
import { answerPortfolioQuestion } from "@/lib/sales/knowledge";
import { getLeadRepository } from "@/lib/sales/repository";

const SESSION_COOKIE = "webnexus_sales_session";

export const runtime = "nodejs";

const salesManager = createSalesConversationManager(
  getLeadRepository(),
  answerPortfolioQuestion,
  createWebhookNotifier(),
);

function sessionFromCookie(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))?.[1] ?? null;
}

export async function POST(request: Request) {
  const sessionId = sessionFromCookie(request);
  if (!sessionId) {
    return Response.json({ success: false, error: "No project session was found." }, { status: 400 });
  }
  const result = await salesManager.submitLead(sessionId);
  if (!result.ok) {
    return Response.json(
      {
        success: false,
        status: result.lead?.status ?? "in_progress",
        lead_reference: result.lead?.backendLeadReference ?? null,
        error: result.error,
      },
      { status: result.status },
    );
  }
  return Response.json({
    success: true,
    status: result.lead.status,
    lead_reference: result.lead.backendLeadReference,
  });
}
