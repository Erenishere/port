import type {
  AssistantIntent,
  ScopedHistoryMessage,
} from "./portfolio-assistant";

export type ProjectFacts = {
  service: "ai" | "business_system" | "web_app" | null;
  stack: string | null;
  stackTerms: string[];
  projectType: string | null;
  dataSource: string | null;
  timeline: string | null;
  hasExistingApp: boolean;
  orderRequested: boolean;
};

export type CondensedConversation = {
  facts: ProjectFacts;
  summary: string;
  retrievalQuery: string;
  recentHistory: ScopedHistoryMessage[];
};

const STACKS: Array<{
  pattern: RegExp;
  label: string;
  terms: string[];
}> = [
  {
    pattern: /\bmern\b/i,
    label: "MERN",
    terms: ["MERN", "MongoDB", "Express.js", "React", "Node.js"],
  },
  {
    pattern: /\bmean\b/i,
    label: "MEAN",
    terms: ["MEAN", "MongoDB", "Express.js", "Angular", "Node.js"],
  },
  { pattern: /\bnext\.?js\b/i, label: "Next.js", terms: ["Next.js", "React"] },
  { pattern: /\breact\b/i, label: "React", terms: ["React"] },
  { pattern: /\bangular\b/i, label: "Angular", terms: ["Angular"] },
  { pattern: /\bnode\.?js\b/i, label: "Node.js", terms: ["Node.js"] },
  { pattern: /\bexpress(?:\.js)?\b/i, label: "Express.js", terms: ["Express.js"] },
  { pattern: /\bmongodb\b/i, label: "MongoDB", terms: ["MongoDB"] },
  { pattern: /\bpostgres(?:ql)?\b/i, label: "PostgreSQL", terms: ["PostgreSQL"] },
  { pattern: /\bmysql\b/i, label: "MySQL", terms: ["MySQL"] },
  { pattern: /\basp\.net\b/i, label: "ASP.NET", terms: ["ASP.NET"] },
  { pattern: /\bfastapi\b/i, label: "FastAPI", terms: ["FastAPI"] },
];

const NAVIGATION_TURN =
  /^(?:where|how).{0,18}(?:order|buy|hire|contact)|^(?:order|contact|pricing|price)[?.! ]*$/i;
const GREETING_OR_ACK =
  /^(?:hi|hello|hey|salam|okay|ok|yes|sure|thanks|thank you|sounds good)[?.! ]*$/i;
const DURABLE_TERMS =
  /\b(ai|chat ?bot|rag|mern|mean|stack|app|website|system|erp|saas|mvp|dashboard|pdf|document|faq|api|database|mongodb|react|angular|node|express|postgres|mysql|timeline|week|month)\b/i;

function userTurns(query: string, history: ScopedHistoryMessage[]) {
  return [
    ...history
      .filter((message) => message.role === "user")
      .map((message) => message.content.trim())
      .filter(Boolean),
    query.trim(),
  ];
}

function lastMatch<T>(
  turns: string[],
  matcher: (turn: string) => T | null,
): T | null {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const match = matcher(turns[index]);
    if (match) return match;
  }
  return null;
}

function detectStack(turns: string[]) {
  return lastMatch(turns, (turn) => {
    const stack = STACKS.find((candidate) => candidate.pattern.test(turn));
    return stack ? { label: stack.label, terms: stack.terms } : null;
  });
}

function detectDataSource(turns: string[]) {
  return lastMatch(turns, (turn) => {
    const hasWebsiteContent = /\bwebsite content|site content|web pages?\b/i.test(
      turn,
    );
    const hasFaqs = /\bfaqs?\b/i.test(turn);
    if (hasWebsiteContent && hasFaqs) return "website content and FAQs";
    if (/\bpdfs?|documents?|manuals?|policies\b/i.test(turn)) return "PDFs/documents";
    if (hasWebsiteContent) {
      return "website content";
    }
    if (hasFaqs) return "FAQs";
    if (/\bapis?\b/i.test(turn)) return "APIs";
    if (/\b(?:internal )?databases?|business data\b/i.test(turn)) {
      return "database/business data";
    }
    return null;
  });
}

function detectProjectType(turns: string[]) {
  return lastMatch(turns, (turn) => {
    if (/\b(?:erp|inventory|warehouse|distribution)\b/i.test(turn)) {
      return "business system/ERP";
    }
    if (/\bsaas\b/i.test(turn)) return "SaaS product";
    if (/\bmvp\b/i.test(turn)) return "MVP";
    if (/\b(?:web app|application|\bapp\b)\b/i.test(turn)) return "web application";
    if (/\bwebsite\b/i.test(turn)) return "website";
    return null;
  });
}

function detectTimeline(turns: string[]) {
  return lastMatch(turns, (turn) => {
    const match = turn.match(
      /\b(?:a|one|1|\d+)\s*(?:day|days|week|weeks|month|months)\b/i,
    );
    return match?.[0] ?? null;
  });
}

function detectService(text: string): ProjectFacts["service"] {
  if (/\b(ai|chat ?bot|rag|copilot|automation|semantic search)\b/i.test(text)) {
    return "ai";
  }
  if (/\b(erp|inventory|warehouse|distribution|business system)\b/i.test(text)) {
    return "business_system";
  }
  if (/\b(web app|website|saas|mvp|dashboard|portal|\bapp\b)\b/i.test(text)) {
    return "web_app";
  }
  return null;
}

function describeService(service: ProjectFacts["service"]) {
  if (service === "ai") return "AI integration";
  if (service === "business_system") return "business system/ERP";
  if (service === "web_app") return "web application";
  return null;
}

function durableHistoryTurn(value: string) {
  return (
    DURABLE_TERMS.test(value) &&
    !NAVIGATION_TURN.test(value.trim()) &&
    !GREETING_OR_ACK.test(value.trim())
  );
}

export function condenseConversation(
  query: string,
  history: ScopedHistoryMessage[],
  intent: AssistantIntent,
): CondensedConversation {
  const turns = userTurns(query, history);
  const combined = turns.join(" ");
  const stack = detectStack(turns);
  const facts: ProjectFacts = {
    service: detectService(combined),
    stack: stack?.label ?? null,
    stackTerms: stack?.terms ?? [],
    projectType: detectProjectType(turns),
    dataSource: detectDataSource(turns),
    timeline: detectTimeline(turns),
    hasExistingApp:
      /\b(existing|current|already have|my)\s+(?:website|web app|app|system)\b/i.test(
        combined,
      ),
    orderRequested: /\b(order|fiverr|gig|buy|hire)\b/i.test(combined),
  };

  const summaryParts = [
    describeService(facts.service) &&
      `service=${describeService(facts.service)}`,
    facts.projectType && `project=${facts.projectType}`,
    facts.stack && `preferred stack=${facts.stack}`,
    facts.dataSource && `data source=${facts.dataSource}`,
    facts.timeline && `timeline=${facts.timeline}`,
    facts.hasExistingApp && "existing system=yes",
    facts.orderRequested && "order requested=yes",
  ].filter((part): part is string => Boolean(part));
  const summary = summaryParts.join("; ");

  const previousRelevantTurn = history
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(durableHistoryTurn)
    .at(-1);
  const needsContext =
    intent === "follow_up" ||
    intent === "project_requirement" ||
    intent === "pricing" ||
    query.trim().split(/\s+/).length <= 4;

  const retrievalParts =
    needsContext && previousRelevantTurn
      ? [previousRelevantTurn, `Follow-up question: ${query}`]
      : [query];
  if (needsContext && summary) {
    retrievalParts.push(`Known project context: ${summary}`);
  }
  if (needsContext && facts.stackTerms.length) {
    retrievalParts.push(`Stack technologies: ${facts.stackTerms.join(", ")}`);
  }

  return {
    facts,
    summary,
    retrievalQuery: retrievalParts.join("\n"),
    recentHistory: history.slice(-2).map((message) => ({
      role: message.role,
      content: message.content.slice(0, 300),
    })),
  };
}
