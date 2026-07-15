import {
  condenseConversation,
  type ProjectFacts,
} from "./conversation-condense";

export type ScopedHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantIntent =
  | "greeting"
  | "introduction"
  | "project_enquiry"
  | "project_requirement"
  | "share_details"
  | "lead_submission"
  | "pricing"
  | "contact"
  | "order"
  | "portfolio_ai"
  | "portfolio_projects"
  | "portfolio_services"
  | "portfolio_process"
  | "follow_up"
  | "abusive"
  | "prompt_injection"
  | "off_topic"
  | "general";

export const PORTFOLIO_SYSTEM_CONTEXT = `
You are the WebNexus portfolio assistant — professional, concise, and helpful.

Scope (stay within these topics):
- WebNexus services, projects, skills, stacks, delivery process, availability, and project enquiries.
- Helping visitors scope a web app, business system, ERP-style workflow, rescue work, or AI integration.
- AI work: topic-scoped chatbots, document/PDF RAG assistants, semantic search, summaries, workflow automation.
- Featured projects:
  • Pharmaceutical Distribution ERP — Angular 18, Node.js, Express.js, MongoDB, REST APIs.
  • Enterprise Voice RAG Assistant — 41 PDFs, five departments, semantic + BM25 retrieval, RRF, Whisper, WebSocket chat, source grounding, session history, query classification, hallucination controls.
  • Crime Reporting and Case Management System — ASP.NET MVC, C#, SQL Server.

Behavior:
- Answer the visitor's latest message directly. Use chat history for follow-ups. Do not repeat a previous answer.
- Greet warmly when introduced; use their name if they share it.
- When someone wants to build something (full-stack app, website, MVP, etc.), treat it as in-scope: acknowledge, ask one or two useful scoping questions, and mention relevant WebNexus services.
- When asked to share project details, welcome it and list what to include. Warn against passwords, API keys, or sensitive data.
- Never claim details were saved or submitted unless a backend confirms it.
- For rude or off-topic messages: stay calm and professional, briefly redirect to portfolio help. Do not lecture or mirror hostility.
- Do not answer general knowledge, politics, entertainment, homework, or unrelated coding tutorials.
- Do not invent prices, timelines, clients, metrics, links, or outcomes. Match a Fiverr service only after requirements are clear.
`.trim();

const blockedPromptPattern =
  /(ignore|forget|override|disregard|bypass).{0,40}(instruction|prompt|rule|guardrail)|system prompt|developer message|jailbreak|(?:act|pretend|roleplay) as (?:a|an)|reveal.{0,20}(prompt|instruction)/i;

const abusivePattern =
  /\b(f+u+[\s-]*c+k+|fu+i+c+k+|sh[i1]+t|damn|idiot|stupid|useless|scam|trash|garbage|hate you)\b/i;

const greetingPattern =
  /^(?:hi|hello|hey|salam|assalam(?:-?o-?alaikum)?|good (?:morning|afternoon|evening))(?:\s|!|,|\.)*$/i;

const introductionPattern =
  /(?:^|\b)(?:i(?:'m| am)|my name is|myself|this is|call me)\s+([a-z][a-z\s'-]{0,24})/i;

const casualGreetingWithNamePattern =
  /^(?:hi|hello|hey)[\s,!.]*(?:myself|i(?:'m| am)|this is)?\s*([a-z][a-z\s'-]{0,24})[\s!.]*$/i;

const projectEnquiryPattern =
  /(?:build|built|want|need|looking for|create|develop|make|start|launch).{0,48}(?:app|website|web\s*app|full[\s-]?stack|system|mvp|saas|dashboard|erp|platform|product|software|portal)|(?:full[\s-]?stack|web\s*app|mobile\s*app|business\s*system)/i;

const aiServicePattern =
  /\b(ai|chat ?bot|chabot|rag|document assistant|pdf assistant|voice assistant|copilot|automation|integrat|integerat)\b/i;

const aiIntegrationEnquiryPattern =
  /\b(?:can|could|do|does|will|want|need|add|build|connect|integrat(?:e|ion)?|integerat(?:e|ion)?)\b.{0,48}\b(?:ai|chat ?bot|chabot|rag|copilot|automation|assistant)\b|\b(?:ai|chat ?bot|chabot|rag|copilot|automation|assistant)\b.{0,48}\b(?:integrat(?:e|ion)?|integerat(?:e|ion)?|add|build|connect)\b/i;

const projectRequirementPattern =
  /(?:\b(?:i|we)\s+(?:want|need|prefer|will use|am using|are using).{0,40}\b(?:mern|mean|next\.?js|react|angular|node\.?js|express(?:\.js)?|mongodb|postgres(?:ql)?|mysql|asp\.net|fastapi)\b)|\b(?:mern|mean)(?:\s+stack|\s+(?:app|application|website|project|system))/i;

const detailsQuestionPattern =
  /(?:can|may|should|where|how).{0,24}(?:send|sent|share|give|submit|drop|paste).{0,32}(?:detail|information|requirement|brief|idea|scope)|what details do you need|send my details|share my details|project details here/i;

const projectDetailPattern =
  /^(?:it(?:'s| is)|the (?:app|website|chatbot|assistant)|(?:i|we) need|(?:i|we) want it|(?:it|the (?:app|website|chatbot|assistant)) should|used by|for (?:a|an|the)|website content|site content|faqs?|pdfs?|documents?|apis?|(?:internal )?database)\b/i;

const leadDetailsPattern =
  /[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|(?:name|email|company|website|budget|timeline|requirement|project|phone)\s*:|my name is|(?:\+?\d[\d\s()-]{7,}\d)/i;

const followUpPattern =
  /^(?:tell me more|how much|how long|what does that cost|what is the timeline|which stack|can you explain|how does it work|can you do that|do you offer that|can you integrate it|can you add it|what details do you need|why|how|is it live|what about that|okay|ok|yes|sure|sounds good|go on|charges?|fees?|a week|one week|1 week)[?.!/ ]*$/i;

const offTopicPattern =
  /(?:capital of|weather|football|movie|song|recipe|homework|solve this|write (?:me )?(?:an )?essay|who is (?:the )?president|bitcoin price|crypto|dating|medical advice|legal advice)/i;

const topicTerms = [
  "webnexus",
  "portfolio",
  "project",
  "service",
  "developer",
  "hire",
  "contact",
  "email",
  "availability",
  "price",
  "pricing",
  "quote",
  "cost",
  "charge",
  "charges",
  "fee",
  "fees",
  "timeline",
  "delivery process",
  "skill",
  "tech stack",
  "technology",
  "website",
  "web app",
  "business system",
  "erp",
  "pharma",
  "pharmaceutical",
  "inventory",
  "angular",
  "react",
  "next.js",
  "mern",
  "mean",
  "postgresql",
  "mysql",
  "node.js",
  "express",
  "mongodb",
  "rest api",
  "dashboard",
  "workflow",
  "frontend",
  "backend",
  "performance",
  "bug fixing",
  "app rescue",
  "ai assistant",
  "ai workflow",
  "ai integration",
  "integrate ai",
  "integrate",
  "integerate",
  "chatbot",
  "chat bot",
  "chabot",
  "automation",
  "copilot",
  "rag",
  "voice assistant",
  "fastapi",
  "chromadb",
  "groq",
  "whisper",
  "websocket",
  "crime reporting",
  "case management",
  "asp.net",
  "sql server",
  "role-based",
  "project brief",
  "send details",
  "share details",
  "my details",
  "requirements",
  "fiverr",
  "gig",
  "order",
  "package",
  "what can you do",
  "who are you",
  "full stack",
  "fullstack",
  "mvp",
  "saas",
];

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function containsPortfolioTopic(value: string) {
  const normalized = normalize(value);
  return (
    /\bai\b/.test(normalized) ||
    aiServicePattern.test(normalized) ||
    projectEnquiryPattern.test(normalized) ||
    topicTerms.some((term) => normalized.includes(term))
  );
}

function getUserHistoryText(history: ScopedHistoryMessage[]) {
  return history
    .filter((message) => message.role === "user")
    .slice(-6)
    .map((message) => message.content)
    .join(" ");
}

function extractRememberedName(history: ScopedHistoryMessage[]) {
  const namedMessage = history
    .filter((message) => message.role === "user")
    .slice()
    .reverse()
    .find((message) => extractName(message.content));

  return namedMessage ? extractName(namedMessage.content) : null;
}

function getMemory(query: string, history: ScopedHistoryMessage[]) {
  const userContext = normalize(`${getUserHistoryText(history)} ${query}`);
  const service =
    aiServicePattern.test(userContext)
      ? "ai"
      : /(erp|inventory|warehouse|distribution|stock|purchase|sales)/.test(userContext)
        ? "erp"
        : /(mern|saas|mvp|web app|website|full stack|dashboard)/.test(userContext)
          ? "web"
          : null;
  const hasExistingApp = /\b(existing app|existing website|current app|current website|my app|my website)\b/.test(
    userContext,
  );
  const timeline = /\b(a|one|1)\s+week\b/.test(userContext)
    ? "one week"
    : /\b\d+\s*(?:day|days|week|weeks|month|months)\b/.exec(userContext)?.[0] ?? null;

  return {
    name: extractName(query) ?? extractRememberedName(history),
    service,
    hasExistingApp,
    timeline,
  };
}

function extractName(query: string) {
  const intro = query.match(introductionPattern);
  if (intro?.[1]) return titleCase(intro[1].trim());

  const casual = query.match(casualGreetingWithNamePattern);
  if (casual?.[1]) return titleCase(casual[1].trim());

  return null;
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function hasScopedHistory(history: ScopedHistoryMessage[]) {
  return history
    .filter((message) => message.role === "user")
    .slice(-4)
    .some((message) => containsPortfolioTopic(message.content));
}

export function classifyIntent(
  query: string,
  history: ScopedHistoryMessage[] = [],
): AssistantIntent {
  const trimmed = query.trim();
  const normalized = normalize(trimmed);

  if (!trimmed) return "off_topic";
  if (blockedPromptPattern.test(trimmed)) return "prompt_injection";
  if (abusivePattern.test(normalized)) return "abusive";

  if (detailsQuestionPattern.test(normalized) || looksLikeLeadDetails(trimmed)) {
    return detailsQuestionPattern.test(normalized) ? "share_details" : "lead_submission";
  }

  if (greetingPattern.test(trimmed) || introductionPattern.test(trimmed) || casualGreetingWithNamePattern.test(trimmed)) {
    return extractName(trimmed) ? "introduction" : "greeting";
  }

  if (/(price|pricing|quote|cost|charge|charges|fee|fees|how much|how long|timeline)/.test(normalized)) {
    return "pricing";
  }

  if (hasScopedHistory(history) && projectDetailPattern.test(trimmed)) {
    return "project_requirement";
  }

  if (projectRequirementPattern.test(normalized)) {
    return "project_requirement";
  }

  if (
    /(what|which|show|tell).{0,24}\bai\b.{0,24}(work|built|build|project)|\bai\b.{0,16}(work|project)/.test(
      normalized,
    ) ||
    aiServicePattern.test(normalized)
  ) {
    return "portfolio_ai";
  }

  if (projectEnquiryPattern.test(normalized)) return "project_enquiry";

  if (/(contact|email|hire|availability|start a project)/.test(normalized)) {
    return "contact";
  }

  if (/(how to order|fiverr|gig|package|order)/.test(normalized)) {
    return "order";
  }

  if (/(pharma|pharmaceutical|erp|inventory|crime|case management|voice|rag)/.test(normalized)) {
    return "portfolio_projects";
  }

  if (/(process|delivery)/.test(normalized)) return "portfolio_process";

  if (
    /(service|what can you do|website|web app|business system|app rescue|bug fixing)/.test(
      normalized,
    )
  ) {
    return "portfolio_services";
  }

  if (/(project|portfolio|case study)/.test(normalized)) return "portfolio_projects";

  if (hasScopedHistory(history) && (followUpPattern.test(trimmed) || trimmed.length < 80)) {
    return "follow_up";
  }

  if (offTopicPattern.test(normalized) && !hasScopedHistory(history)) {
    return "off_topic";
  }

  if (containsPortfolioTopic(normalized)) return "general";

  return hasScopedHistory(history) ? "follow_up" : "off_topic";
}

export function isGreeting(query: string) {
  const intent = classifyIntent(query);
  return intent === "greeting" || intent === "introduction";
}

export function looksLikeLeadDetails(query: string) {
  return leadDetailsPattern.test(query.trim());
}

export function isPortfolioConversation(
  query: string,
  history: ScopedHistoryMessage[],
) {
  const intent = classifyIntent(query, history);
  return intent !== "off_topic" && intent !== "prompt_injection";
}

export function shouldUseLocalResponse(
  query: string,
  history: ScopedHistoryMessage[],
) {
  const intent = classifyIntent(query, history);
  switch (intent) {
    case "greeting":
    case "introduction":
    case "project_enquiry":
    case "project_requirement":
    case "share_details":
    case "lead_submission":
    case "order":
    case "portfolio_projects":
      return true;
    case "portfolio_ai":
      return aiIntegrationEnquiryPattern.test(query);
    case "follow_up":
      return /^(?:okay|ok|yes|sure|sounds good|go on)[.! ]*$/i.test(
        query.trim(),
      );
    default:
      return false;
  }
}

export function getGuardReply(query: string, history: ScopedHistoryMessage[] = []) {
  const intent = classifyIntent(query, history);

  if (intent === "prompt_injection") {
    return "I can only help with WebNexus portfolio topics — projects, services, stacks, and starting a build.";
  }

  if (intent === "abusive") {
    return "I'm here to help professionally with project questions — services, case studies, pricing, or sharing your brief. What would you like to explore?";
  }

  if (hasScopedHistory(history)) {
    return "That's outside what I cover here. Want to continue with your project question, or explore WebNexus services and case studies?";
  }

  return "I focus on WebNexus — projects, services, tech stacks, and how to start a build. What are you looking to create or learn about?";
}

function describeStack(facts: ProjectFacts) {
  if (facts.stack === "MERN") {
    return "MERN (MongoDB, Express.js, React, and Node.js)";
  }
  if (facts.stack === "MEAN") {
    return "MEAN (MongoDB, Express.js, Angular, and Node.js)";
  }
  return facts.stack;
}

function projectRequirementReply(facts: ProjectFacts) {
  const stack = describeStack(facts);
  const stackNote = stack
    ? `Yes — ${stack} is in scope and noted as your preferred stack.`
    : "";
  const preface = stackNote ? `${stackNote} ` : "";

  if (facts.service === "ai") {
    const project = facts.projectType ? ` for your ${facts.projectType}` : "";
    if (!facts.dataSource) {
      return `${preface}Since this is an AI integration${project}, what should the assistant help users do, and should its answers come from website content, PDFs, APIs, or a database?`;
    }
    return `${preface}${facts.dataSource} noted as the AI data source. What types of questions or tasks should it handle first, and should it hand users off to a person when it cannot help?`;
  }

  if (facts.service === "business_system") {
    return `${preface}That sounds like a business system/ERP. Which user roles need access, are there existing data or integrations to preserve, and what timeline are you working toward?`;
  }

  if (facts.service === "web_app") {
    return `${preface}That sounds like a web application. Who will use it, what are the first-version features or workflows, and what timeline are you working toward?`;
  }

  return `${preface}What is the app's main goal, who will use it, and which features or workflows should the first version include?`;
}

function orderReply(facts: ProjectFacts) {
  const service =
    facts.service === "ai"
      ? "AI integration"
      : facts.service === "business_system"
        ? "a business system/ERP"
        : facts.service === "web_app"
          ? "a web application"
          : null;
  const projectType =
    facts.projectType === "business system/ERP" &&
    facts.service === "business_system"
      ? null
      : facts.projectType;
  const known = [
    service,
    projectType,
    describeStack(facts),
    facts.dataSource,
    facts.timeline,
  ].filter((item): item is string => Boolean(item));

  if (!known.length) {
    return "Share the project goal, current website or app, required features, data sources, and timeline first. Once those requirements are clear, I can identify the matching Fiverr service without sending an unrelated gig.";
  }

  return `I have noted: ${[...new Set(known)].join(", ")}. Before I can identify the matching Fiverr service, share the main goal, required features, data source, and preferred timeline that are still missing.`;
}

export function getPortfolioFallbackReply(
  query: string,
  history: ScopedHistoryMessage[] = [],
) {
  const intent = classifyIntent(query, history);
  const name = extractName(query);
  const memory = getMemory(query, history);
  const conversation = condenseConversation(query, history, intent);
  const recentContext = normalize(
    history
      .filter((message) => message.role === "user")
      .slice(-2)
      .map((message) => message.content)
      .join(" "),
  );
  const intentContext = `${normalize(query)} ${recentContext}`.trim();

  switch (intent) {
    case "greeting":
      return "Hi! I can help you explore WebNexus projects, services, tech stacks, pricing, or scope a new build. What are you looking for today?";

    case "introduction":
      return name
        ? `Hi ${name}! Good to meet you. I can walk you through WebNexus projects, services, or help you scope a new build. What brought you here today?`
        : "Hi! Good to meet you. I can walk you through WebNexus projects, services, or help you scope a new build. What brought you here today?";

    case "project_enquiry":
      if (conversation.facts.service === "ai") {
        const project = conversation.facts.projectType ?? "web application";
        const stack = describeStack(conversation.facts);
        return `Yes — an AI-enabled ${project} is in scope.${stack ? ` I have noted ${stack} as the preferred stack.` : ""} What should the AI help users do, and should it answer from website content, PDFs, APIs, or a database?`;
      }
      return "Yes — WebNexus builds full-stack web apps, business systems, and AI integrations. To point you in the right direction: what's the product goal, who will use it, and do you already have a preferred stack or timeline?";

    case "project_requirement":
      return projectRequirementReply(conversation.facts);

    case "share_details":
      return "Yes — you can share project details here. Send your name, email, current website or app URL, what you want built, key features, data sources, and preferred timeline. Please do not share passwords, API keys, or sensitive customer data. I'll use this as chat context to suggest the right service path.";

    case "lead_submission":
      return "Thanks — those details are now part of this chat context, but they have not been submitted as an order. Add any missing goal, data source, or timeline, then ask how to order so I can identify the matching service. Please never share passwords or API keys here.";

    case "pricing":
      return "Pricing and delivery time depend on scope, integrations, workflow complexity, user roles, data sources, interface requirements, deployment, and testing. WebNexus provides a custom estimate after the requirements are understood. What goal, features, data sources, and timeline should the estimate cover?";

    case "contact":
      return "You can contact WebNexus at hello@webnexus.dev. To get a useful project response, include the goal, current system, users, key features, data sources, and preferred timeline.";

    case "order":
      return orderReply(conversation.facts);

    case "portfolio_ai":
      if (aiIntegrationEnquiryPattern.test(intentContext)) {
        const target = memory.hasExistingApp
          ? "your existing website or web app"
          : "a new or existing website or web app";
        return `${memory.name ? `${memory.name}, ` : ""}yes — WebNexus can integrate AI into ${target}. Suitable options include a lead-qualification chatbot, customer-support assistant, document/PDF RAG assistant, semantic search, summaries, or workflow automation.\n\nWhat should the AI help users do, and should it use website content, PDFs, APIs, or an approved internal database?`;
      }
      return "The strongest AI case study is an Enterprise Voice RAG Assistant built for 41 internal PDF documents across five departments. It uses semantic and BM25 search with Reciprocal Rank Fusion, Whisper voice transcription, WebSocket chat, source-grounded answers, session history, query classification, and hallucination controls.";

    case "portfolio_projects":
      if (/(pharma|pharmaceutical|erp|inventory|angular|mongodb|express|node\.js)/.test(intentContext)) {
        return "The main featured project is a live Pharmaceutical Distribution ERP. It centralizes inventory, purchasing, sales, suppliers, customers, reporting, role-based access, and business validations using Angular 18, Node.js, Express.js, MongoDB, and REST APIs.";
      }
      if (/(voice|rag|fastapi|chromadb|groq|whisper|websocket)/.test(intentContext)) {
        return "The Enterprise Voice RAG Assistant answers employee questions from internal PDFs and policies. It combines semantic and BM25 search, Reciprocal Rank Fusion, voice transcription, source-grounded answers, session history, classification, and hallucination controls.";
      }
      if (/(crime|case management|asp\.net|sql server|citizen|officer)/.test(intentContext)) {
        return "The Crime Reporting and Case Management System supports citizen, officer, and admin roles, incident reporting, case assignment and tracking, session authentication, password hashing, an administrative dashboard, and SQL Server integration.";
      }
      return "The portfolio highlights three real systems: a Pharmaceutical Distribution ERP, an Enterprise Voice RAG Assistant, and a Crime Reporting and Case Management System. Which one would you like to hear about?";

    case "portfolio_services":
      return "WebNexus focuses on product builds, business systems, app rescue work, and practical AI enhancements — including web apps, ERP-style workflows, dashboards, APIs, performance improvements, and document-based AI assistants.";

    case "portfolio_process":
      return "The delivery path is: discover the real workflow, architect the system, design the interface and states, develop the product, then refine and launch it.";

    case "abusive":
    case "off_topic":
    case "prompt_injection":
      return getGuardReply(query, history);

    case "follow_up":
      if (memory.service === "ai" && memory.timeline) {
        return `${memory.timeline === "one week" ? "One week" : `A ${memory.timeline} timeline`} can work for a simple chatbot integration or a focused first version. If the chatbot needs internal database/API access, auth, roles, or complex workflows, the safer estimate may be longer unless we keep the first scope tight.\n\nFor a one-week MVP, I’d suggest starting with one clear use case, one data source, and a simple handoff/contact flow. What stack is your existing app using?`;
      }

      if (memory.service === "ai") {
        return `${memory.name ? `${memory.name}, ` : ""}we were discussing an AI chatbot for ${memory.hasExistingApp ? "your existing app" : "your app"}. I can help narrow scope, pricing, timeline, or ordering. What should the chatbot answer from: website content, PDFs, APIs, or an internal database?`;
      }

    case "general":
    default:
      if (/\bai\b/.test(intentContext)) {
        return "WebNexus offers practical AI enhancements for real workflows, including topic-scoped chatbots, document/PDF RAG assistants, semantic search and summaries, voice-enabled knowledge tools, and automation connected to an existing web product.";
      }
      return "I do not have confirmed information about that in the WebNexus knowledge base. I can help with WebNexus services, projects, technology stacks, delivery process, or starting a project.";
  }
}

// Kept for any legacy imports; prefer getGuardReply for contextual redirects.
export const OUT_OF_SCOPE_REPLY = getGuardReply("");
