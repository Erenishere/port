import { getGuardReply, classifyIntent } from "@/lib/portfolio-assistant";
import { answerPortfolioQuestion } from "@/lib/sales/knowledge";
import {
  createSalesConversationManager,
  createWebhookNotifier,
} from "@/lib/sales/conversation";
import { getLeadRepository } from "@/lib/sales/repository";

type ChatRequestBody = {
  query?: unknown;
  history?: unknown;
  start_new?: unknown;
};

const MAX_QUERY_LENGTH = 600;
const MAX_BODY_LENGTH = 32_000;
const SESSION_COOKIE = "webnexus_sales_session";

export const runtime = "nodejs";

const salesManager = createSalesConversationManager(
  getLeadRepository(),
  answerPortfolioQuestion,
  createWebhookNotifier(),
);

function sessionFromCookie(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}

function sessionCookie(sessionId: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;
}

async function parseBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_LENGTH) {
    return { error: "Request body is too large.", status: 413 } as const;
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_LENGTH) {
    return { error: "Request body is too large.", status: 413 } as const;
  }

  try {
    return { body: JSON.parse(rawBody) as ChatRequestBody } as const;
  } catch {
    return { error: "Invalid JSON body.", status: 400 } as const;
  }
}

export async function POST(request: Request) {
  const parsed = await parseBody(request);
  if ("error" in parsed) {
    return Response.json({ error: parsed.error }, { status: parsed.status });
  }

  const query =
    typeof parsed.body.query === "string" ? parsed.body.query.trim() : "";
  if (!query) {
    return Response.json({ error: "A message is required." }, { status: 400 });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return Response.json(
      { error: `Messages must be ${MAX_QUERY_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }

  const startNewConversation = parsed.body.start_new === true;
  const existingSession = startNewConversation ? null : sessionFromCookie(request);
  const sessionId = existingSession ?? crypto.randomUUID();
  const intent = classifyIntent(query);
  const response =
    intent === "prompt_injection" || intent === "abusive"
      ? Response.json({
          answer: getGuardReply(query),
          sources: [],
          rewritten_query: query,
          mode: "guard",
          restricted: true,
        })
      : await salesManager.handleTurn(sessionId, query).then((turn) =>
          Response.json({
            answer: turn.answer,
            sources: [],
            rewritten_query: query,
            mode: "sales",
            restricted: false,
            rag_used: turn.usedKnowledge,
            lead: {
              phase: turn.lead.phase,
              status: turn.lead.status,
              project_type: turn.lead.projectType,
              active_question_field: turn.lead.activeQuestionField,
            },
          }),
        );

  if (!existingSession) response.headers.set("Set-Cookie", sessionCookie(sessionId));
  return response;
}
