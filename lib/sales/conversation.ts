import {
  hasAnswered,
  isLeadEligibleForSubmission,
  markAnswered,
  recordChange,
  type LeadField,
  type LeadRecord,
  type ProjectType,
} from "./lead";
import { NotificationOutboxWorker } from "./outbox-worker";
import type { LeadNotifier } from "./notifications";
import type { LeadRepository } from "./repository";

export { createWebhookNotifier } from "./notifications";
export type { LeadNotifier } from "./notifications";

export type KnowledgeAnswerer = (query: string, lead: LeadRecord) => Promise<string | null>;

export type SalesTurnResult = {
  answer: string;
  lead: LeadRecord;
  usedKnowledge: boolean;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRICING_PATTERN = /\b(price|pricing|cost|quote|budget|rate|package|how much|charges?|fees?)\b|\bprice\s+kya|\bkitn[ai]\s+(?:price|cost)/i;
const SUBMISSION_PATTERN = /\b(?:submit|send|proceed|go ahead|request)(?:\s+(?:my|the|this))?\s+(?:quote|request|lead|it)|\bsubmit it\b/i;
const CONSENT_PATTERN = /^(?:yes|yes[,.! ]*(?:submit it|send it|i agree|i consent|proceed)|submit it|send it|i agree|i consent|proceed)[.! ]*$/i;
const KNOWLEDGE_PATTERN = /^(?:what|which|who|show|tell|can|do|have).{0,120}\b(?:service|project|portfolio|technology|stack|database|process|ai work|erp|rag|chat ?bot|integration|capabilit|built|build)/i;
const GREETING_PATTERN = /^(?:hi|hello|hey|salam|assalam(?:-?o-?alaikum)?|good (?:morning|afternoon|evening))[!. ]*$/i;
const SUMMARY_PATTERN = /^(?:where were we|what have you noted|summari[sz]e (?:my|the) (?:project|requirements)|show (?:my|the) (?:project )?summary)[?.! ]*$/i;

const featurePatterns: Array<[RegExp, string]> = [
  [/\b(?:inventory|invertory)|stock\b/i, "inventory management"],
  [/\bpurchas(?:e|ing)\b/i, "purchasing"],
  [/\bsales(?: orders?)?\b/i, "sales"],
  [/\bexpir(?:y|ies)\b/i, "expiry tracking"],
  [/\breport(?:ing|s)?\b/i, "reporting"],
  [/\bwarehouse\b/i, "warehouse management"],
  [/\bdashboard\b/i, "dashboard"],
  [/\bauth(?:entication)?|login\b/i, "authentication"],
  [/\brole[- ]?based|permissions?\b/i, "role-based access"],
  [/\bchat ?bot\b/i, "chatbot"],
  [/\bai\b|artificial intelligence/i, "AI integration"],
  [/\bsemantic search\b/i, "semantic search"],
  [/\bsummar(?:y|ies|ization)\b/i, "summaries"],
  [/\bautomation\b/i, "workflow automation"],
  [/\bslow|performance\b/i, "performance improvement"],
  [/\bbug(?:s|gy)?|broken\b/i, "bug fixing"],
  [/\bsecurity|secure\b/i, "security improvement"],
];

const rolePatterns: Array<[RegExp, string]> = [
  [/\badmin(?:istrator)?s?\b/i, "administrators"],
  [/\bwarehouse (?:staff|team|users?)\b/i, "warehouse staff"],
  [/\bsales (?:staff|team|representatives?|users?)\b/i, "sales users"],
  [/\baccountants?\b/i, "accountants"],
  [/\bmanagers?|management\b/i, "managers"],
  [/\bcustomers?\b/i, "customers"],
  [/\bstaff\b/i, "staff"],
  [/\bemployees?\b/i, "employees"],
];

const stackPatterns: Array<[RegExp, string]> = [
  [/\bmern\b/i, "MERN"],
  [/\bmean\b/i, "MEAN"],
  [/\bnext\.?js\b/i, "Next.js"],
  [/\breact\b/i, "React"],
  [/\bangular\b/i, "Angular"],
  [/\basp\.?(?:net)?\b/i, "ASP.NET"],
  [/\bnode\.?js\b/i, "Node.js"],
];

function unique(values: string[]) {
  return [...new Set(values)];
}

function detectProjectType(text: string): ProjectType | null {
  if (/\b(?:erp|inventory|warehouse|distribution)\b/i.test(text)) return "erp";
  if (/\b(?:app rescue|broken|bug(?:gy|s)?|slow (?:app|application)|performance issue)\b/i.test(text)) {
    return "app_rescue";
  }
  if (/\b(?:chat ?bot|rag assistant|trained on|document assistant|pdf assistant)\b/i.test(text)) {
    return "ai_assistant";
  }
  if (/\b(?:api|backend)\b/i.test(text)) return "api_backend";
  if (/\bdashboard\b/i.test(text)) return "dashboard";
  if (/\b(?:web app|website|mvp|saas|mern|mean|full[ -]?stack)\b/i.test(text)) {
    return "web_app";
  }
  return null;
}

function isProjectDirection(text: string) {
  return /\b(?:i|we)(?:\s+also)?\s+(?:need|want|are looking for|would like|plan to build)|\bbuild\s+(?:(?:me|us)\s+)?(?:(?:an?|the)\s+)?(?=erp|mern|mean|app|application|website|chat ?bot|dashboard|api)|\bactually,?\s+(?:i|we)(?:\s+also)?\s+(?:need|want)|\b(?:mujhe|hamain|hamein)\b.{0,50}\bchahiye\b|\b(?:erp|app|website|chat ?bot)\b.{0,30}\bchahiye\b|\b(?:our|my)\s+(?:existing\s+)?(?:mern\s+|mean\s+|react\s+)?(?:app|application|website)\b.{0,60}\b(?:broken|slow|buggy|bugs?)\b/i.test(
    text,
  );
}

function isCorrection(text: string) {
  return /\b(?:actually|instead|change that|we do not|we don't|remove|without|no longer|not ai|does not need|do not need)\b/i.test(text);
}

function projectLabel(projectType: ProjectType | null) {
  switch (projectType) {
    case "erp":
      return "ERP/business system";
    case "web_app":
      return "web application";
    case "ai_assistant":
      return "AI assistant";
    case "app_rescue":
      return "app rescue project";
    case "api_backend":
      return "API/backend project";
    case "dashboard":
      return "dashboard";
    default:
      return "project";
  }
}

function featureMatches(text: string) {
  return featurePatterns.filter(([pattern]) => pattern.test(text)).map(([, value]) => value);
}

function roleMatches(text: string) {
  const roles = rolePatterns.filter(([pattern]) => pattern.test(text)).map(([, value]) => value);
  return roles.some((role) => role === "warehouse staff" || role === "sales users")
    ? roles.filter((role) => role !== "staff")
    : roles;
}

function stackMatches(text: string) {
  return stackPatterns.filter(([pattern]) => pattern.test(text)).map(([, value]) => value);
}

function setScalar(
  lead: LeadRecord,
  field: Extract<LeadField, "projectType" | "businessGoal" | "currentSystem" | "timelineText" | "budgetText">,
  value: string,
) {
  if (field === "projectType") return;
  const property = field;
  if (lead[property] === value) return;
  lead[property] = value;
  markAnswered(lead, field);
  recordChange(lead, field, value);
}

function setList(lead: LeadRecord, field: "usersAndRoles" | "requestedFeatures" | "currentSystemProblems" | "integrations" | "dataSources" | "stackPreference", values: string[]) {
  if (!values.length) return;
  const merged = unique([...lead[field], ...values]);
  if (merged.length === lead[field].length) return;
  lead[field] = merged;
  markAnswered(lead, field);
  recordChange(lead, field, merged.join(", "));
}

function resetIncompatibleScope(lead: LeadRecord) {
  lead.businessGoal = null;
  lead.usersAndRoles = [];
  lead.requestedFeatures = [];
  lead.currentSystem = null;
  lead.currentSystemProblems = [];
  lead.integrations = [];
  lead.dataSources = [];
  lead.stackPreference = [];
  lead.budgetText = null;
  lead.budgetMin = null;
  lead.budgetMax = null;
  lead.budgetCurrency = null;
  lead.timelineText = null;
  lead.activeQuestionField = null;
  lead.answeredFields = lead.answeredFields.filter(
    (field) => field === "contactName" || field === "contactEmail",
  );
  lead.consentToSubmit = false;
  lead.consentAt = null;
}

function removeObsoleteFeatures(lead: LeadRecord, text: string) {
  if (!/\b(?:do not|don't|remove|without|no longer|not ai|does not need)\b/i.test(text)) return;
  const removals = featureMatches(text);
  if (!removals.length) return;
  lead.requestedFeatures = lead.requestedFeatures.filter(
    (feature) => !removals.includes(feature),
  );
  recordChange(lead, "requestedFeatures", `removed: ${removals.join(", ")}`);
}

function appendTranscript(lead: LeadRecord, role: "user" | "assistant", content: string) {
  lead.transcript.push({ role, content, createdAt: new Date().toISOString() });
}

function explicitBusinessGoal(text: string, projectType: ProjectType | null) {
  const toMatch = text.match(/\b(?:to|so that)\s+(.{3,180})/i);
  if (toMatch?.[1]) return toMatch[1].replace(/[.!?]+$/, "").trim();
  if (projectType === "erp" && /\bwarehouse\b/i.test(text)) return "Manage warehouse operations";
  if (projectType === "erp" && /\bdistribution\b/i.test(text)) return "Manage distribution operations";
  if (projectType === "ai_assistant" && /\b(?:customer|support)\b/i.test(text)) return "Answer customer questions";
  if (projectType === "app_rescue" && /\b(?:broken|slow|bug(?:s|gy)?|performance)\b/i.test(text)) {
    return "Repair and improve the existing application";
  }
  return null;
}

function parseBudget(text: string) {
  const range = text.match(/(?:\$|usd\s*)?(\d[\d,]*(?:\.\d+)?)\s*(?:-|–|to)\s*(?:\$|usd\s*)?(\d[\d,]*(?:\.\d+)?)/i);
  const single = text.match(/(?:\$|usd\s*)(\d[\d,]*(?:\.\d+)?)/i);
  const shorthand = text.match(/(?:\$|usd\s*)?(\d+(?:\.\d+)?)\s*k\b(?:\s*usd)?/i);
  const numbers = range ?? single ?? shorthand;
  if (!numbers) return null;
  const multiplier = shorthand && numbers === shorthand ? 1_000 : 1;
  const min = Number(numbers[1].replace(/,/g, "")) * multiplier;
  const max = range ? Number(numbers[2].replace(/,/g, "")) : min;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max, currency: /(?:\$|usd)/i.test(text) ? "USD" : null };
}

function parseTimeline(text: string) {
  const match = text.match(
    /\b(?:within|in|around)?\s*(\d+|one|two|three|four|five|six)\s*(day|days|week|weeks|month|months|mnth|mnths|mth|mths)\b/i,
  );
  if (!match) return null;
  const unit = /^d/i.test(match[2])
    ? "days"
    : /^(?:w)/i.test(match[2])
      ? "weeks"
      : "months";
  return `${match[1]} ${unit}`;
}

function isOnlyProjectRestatement(text: string) {
  return /^(?:yes[, ]*)?(?:an?\s+)?(?:erp(?:\s+system)?|web\s+app(?:lication)?|ai\s+assistant|chat ?bot|dashboard|api|app\s+rescue)(?:\s+with\s+ai)?[.! ]*$/i.test(
    text.trim(),
  );
}

function applyActiveAnswer(lead: LeadRecord, text: string) {
  const field = lead.activeQuestionField;
  if (!field) return false;
  if (field === "projectType") {
    const projectType = detectProjectType(text);
    if (projectType) {
      if (projectType !== lead.projectType) resetIncompatibleScope(lead);
      lead.projectType = projectType;
      markAnswered(lead, field);
      recordChange(lead, field, projectType);
      return true;
    }
  }
  if (field === "businessGoal" && !isOnlyProjectRestatement(text) && text.length > 2) {
    setScalar(lead, "businessGoal", text.trim());
    return true;
  }
  if (field === "currentSystem" && text.length > 1) {
    if (!/^(?:none|scratch|(?:start|starting)?\s*from scratch|new)[.! ]*$|\b(?:excel|manual|paper|system|software|app|application|website|database|crm|erp)\b/i.test(text.trim())) {
      return false;
    }
    setScalar(
      lead,
      "currentSystem",
      /^(?:none|scratch|(?:start|starting)?\s*from scratch|new)[.! ]*$/i.test(text.trim())
        ? "No existing system"
        : text.trim(),
    );
    return true;
  }
  if (field === "timelineText" && parseTimeline(text)) {
    setScalar(lead, "timelineText", parseTimeline(text)!);
    return true;
  }
  if (field === "budgetText") {
    const budget = parseBudget(text);
    if (budget) {
      setScalar(lead, "budgetText", text.trim());
      lead.budgetMin = budget.min;
      lead.budgetMax = budget.max;
      lead.budgetCurrency = budget.currency;
      return true;
    }
    if (/\b(?:not sure|unknown|no (?:fixed )?budget|not decided|flexible)\b/i.test(text)) {
      setScalar(lead, "budgetText", "Not specified");
      return true;
    }
  }
  if (field === "contactName") {
    const email = text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0];
    const namePart = text
      .replace(email ?? "", "")
      .replace(/[,;\s]+$/, "")
      .trim();
    if (/^([a-z][a-z '-]{1,80})$/i.test(namePart)) {
      lead.contact.name = namePart;
      markAnswered(lead, field);
      recordChange(lead, field, lead.contact.name);
      if (email && EMAIL_PATTERN.test(email)) {
        lead.contact.email = email.toLowerCase();
        markAnswered(lead, "contactEmail");
        recordChange(lead, "contactEmail", lead.contact.email);
      }
      return true;
    }
  }
  if (field === "contactEmail") {
    const email = text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0];
    if (email && EMAIL_PATTERN.test(email)) {
      lead.contact.email = email.toLowerCase();
      markAnswered(lead, field);
      recordChange(lead, field, lead.contact.email);
      return true;
    }
  }
  if (field === "usersAndRoles") {
    if (/^(?:all|everyone|all users?)[.! ]*$/i.test(text.trim())) {
      setList(lead, "usersAndRoles", ["all user groups"]);
      return true;
    }
    const roles = roleMatches(text);
    if (roles.length) {
      setList(lead, "usersAndRoles", roles);
      return true;
    }
  }
  if (field === "requestedFeatures") {
    const features = featureMatches(text);
    if (features.length) {
      setList(lead, "requestedFeatures", features);
      return true;
    }
  }
  if (field === "integrations") {
    if (/^(?:no(?:\s+integrations?(?:\s+are)?(?:\s+needed)?)?|none|standalone)[.! ]*$/i.test(text.trim())) {
      markAnswered(lead, field);
      recordChange(lead, field, "none");
      return true;
    }
    if (/^(?:(?:i )?(?:(?:do not|don't|dont) know)|not sure|unknown)[.! ]*$/i.test(text.trim())) {
      markAnswered(lead, field);
      recordChange(lead, field, "unknown");
      return true;
    }
    if (/\b(?:accounting|api|payment|database|excel|crm|erp|quickbooks|website|import|records?|data)\b/i.test(text)) {
      setList(lead, "integrations", [text.trim()]);
      return true;
    }
  }
  if (field === "quoteReview") {
    if (/^(?:yes(?:,?\s*submit it)?|sure|okay|ok|prepare (?:a|the) quote|collect (?:my )?details|go ahead)[.! ]*$/i.test(text.trim())) {
      markAnswered(lead, field);
      recordChange(lead, field, "approved contact capture");
      return true;
    }
  }
  return false;
}

function applyExplicitUpdates(lead: LeadRecord, text: string) {
  const projectType = detectProjectType(text);
  const direction = projectType && isProjectDirection(text);
  if ((direction || isCorrection(text)) && projectType && projectType !== lead.projectType) {
    resetIncompatibleScope(lead);
    lead.projectType = projectType;
    markAnswered(lead, "projectType");
    recordChange(lead, "projectType", projectType);
  }

  const goal = explicitBusinessGoal(text, direction ? projectType : lead.projectType);
  if (goal) setScalar(lead, "businessGoal", goal);

  const removingFeatures = /\b(?:do not|don't|remove|without|no longer|not ai|does not need)\b/i.test(text);
  removeObsoleteFeatures(lead, text);
  if (!removingFeatures) setList(lead, "requestedFeatures", featureMatches(text));
  setList(lead, "usersAndRoles", roleMatches(text));
  setList(lead, "stackPreference", stackMatches(text));

  if (/\b(?:website content|site content|web pages?)\b/i.test(text)) {
    setList(lead, "dataSources", ["website content"]);
  }
  if (/\b(?:pdfs?|documents?|manuals?|policies)\b/i.test(text)) {
    setList(lead, "dataSources", ["documents/PDFs"]);
  }
  if (/\bfaqs?\b/i.test(text)) setList(lead, "dataSources", ["FAQs"]);
  if (/\b(?:internal )?database|business data\b/i.test(text)) {
    setList(lead, "dataSources", ["internal database"]);
  }
  if (/\bcustomers?\b/i.test(text) && /\brecords?\b/i.test(text)) {
    setList(lead, "dataSources", ["customer records"]);
  }
  if (/\binventory\b/i.test(text) && /\brecords?\b/i.test(text)) {
    setList(lead, "dataSources", ["inventory records"]);
  }

  if (
    /\b(?:existing|current)\s+(?:system|app|application|website)|\bexcel\b/i.test(text) ||
    (lead.projectType === "app_rescue" &&
      /\b(?:our|my)\s+(?:mern\s+|mean\s+|react\s+)?(?:app|application|website)\b/i.test(text))
  ) {
    setScalar(lead, "currentSystem", text.trim());
  } else if (/\b(?:new system|start(?:ing)? from scratch|no existing system)\b/i.test(text)) {
    setScalar(lead, "currentSystem", "No existing system");
  }
  if (/\bslow|broken|bug(?:s|gy)?|crash|unreliable|performance\b/i.test(text)) {
    const problems = [
      /\bslow|performance\b/i.test(text) ? "performance issues" : null,
      /\bbug(?:s|gy)?\b/i.test(text) ? "bugs" : null,
      /\bbroken\b/i.test(text) ? "broken functionality" : null,
      /\bcrash\b/i.test(text) ? "crashes" : null,
      /\bunreliable\b/i.test(text) ? "reliability issues" : null,
    ].filter((value): value is string => Boolean(value));
    setList(lead, "currentSystemProblems", problems);
  }
  if (/\b(?:accounting|payment|crm|third[- ]party api|external api)\b/i.test(text)) {
    setList(lead, "integrations", [text.trim()]);
  }

  const timeline = parseTimeline(text);
  if (timeline) setScalar(lead, "timelineText", timeline);
  const budget = parseBudget(text);
  if (budget) {
    setScalar(lead, "budgetText", text.trim());
    lead.budgetMin = budget.min;
    lead.budgetMax = budget.max;
    lead.budgetCurrency = budget.currency;
  }

  const name = text.match(/\b(?:my name is|i am|i'm)\s+([a-z][a-z '-]{1,80})/i)?.[1];
  if (name) {
    lead.contact.name = name.trim();
    markAnswered(lead, "contactName");
    recordChange(lead, "contactName", lead.contact.name);
  }
  const email = text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0];
  if (email && EMAIL_PATTERN.test(email)) {
    lead.contact.email = email.toLowerCase();
    markAnswered(lead, "contactEmail");
    recordChange(lead, "contactEmail", lead.contact.email);
  }
}

function advancePhase(lead: LeadRecord) {
  if (lead.status === "submitted") return;
  if (!lead.projectType || !lead.businessGoal) {
    lead.phase = "discover";
    lead.status = lead.status === "new" ? "new" : "in_progress";
    return;
  }
  if (!lead.usersAndRoles.length || !lead.requestedFeatures.length || !hasAnswered(lead, "currentSystem")) {
    lead.phase = "qualify";
    lead.status = "in_progress";
    return;
  }
  if (!hasAnswered(lead, "integrations") || !lead.timelineText || !hasAnswered(lead, "budgetText")) {
    lead.phase = "scope";
    lead.status = "qualified";
    return;
  }
  if (!hasAnswered(lead, "quoteReview")) {
    lead.phase = "quote_request";
    lead.status = "qualified";
    return;
  }
  if (!lead.contact.name || !lead.contact.email) {
    lead.phase = "contact_capture";
    lead.status = "awaiting_contact";
    return;
  }
  lead.phase = "quote_request";
  lead.status = lead.consentToSubmit ? "ready_to_submit" : "awaiting_contact";
}

function nextMissingField(lead: LeadRecord): LeadField | null {
  if (!lead.projectType) return "projectType";
  if (!lead.businessGoal) return "businessGoal";
  if (!lead.usersAndRoles.length) return "usersAndRoles";
  if (!lead.requestedFeatures.length) return "requestedFeatures";
  if (!hasAnswered(lead, "currentSystem")) return "currentSystem";
  if (!hasAnswered(lead, "integrations")) return "integrations";
  if (!lead.timelineText) return "timelineText";
  if (!hasAnswered(lead, "budgetText")) return "budgetText";
  if (!hasAnswered(lead, "quoteReview")) return "quoteReview";
  if (!lead.contact.name) return "contactName";
  if (!lead.contact.email) return "contactEmail";
  if (!lead.consentToSubmit) return "consent";
  return null;
}

function questionFor(field: LeadField | null, lead: LeadRecord) {
  switch (field) {
    case "projectType":
      return "What would you like to build or improve: an ERP, web app, AI assistant, dashboard, API, or an existing-app rescue?";
    case "businessGoal":
      return `What main business problem should this ${projectLabel(lead.projectType)} solve?`;
    case "usersAndRoles":
      return "Who will use it—for example administrators, staff, managers, customers, or another group?";
    case "requestedFeatures":
      return "What are the most important workflows or features for the first version?";
    case "currentSystem":
      return "Are you replacing an existing system, or starting from scratch?";
    case "integrations":
      return "Does it need to connect to existing data, accounting software, a website, payments, or third-party APIs?";
    case "timelineText":
      return "What timeline are you working toward?";
    case "budgetText":
      return "Do you have a budget range in mind? It is fine to say that it is not decided yet.";
    case "quoteReview":
      return `${summarizeLead(lead)} Shall I collect your name and email so the WebNexus team can prepare a tailored quote?`;
    case "contactName":
      return "Please share your name so the WebNexus team can prepare the quote request.";
    case "contactEmail":
      return "What email address should the team use to contact you?";
    case "consent":
      return "Do you authorize WebNexus to send this project summary and conversation to the team for a quote? Reply “Yes, submit it” to continue.";
    default:
      return null;
  }
}

function confirmation(lead: LeadRecord, before: LeadRecord) {
  const parts: string[] = [];
  if (lead.projectType !== before.projectType && lead.projectType) {
    parts.push(`${projectLabel(lead.projectType)} noted`);
  }
  if (lead.businessGoal !== before.businessGoal && lead.businessGoal) {
    parts.push(`goal noted: ${lead.businessGoal}`);
  }
  const addedFeatures = lead.requestedFeatures.filter((item) => !before.requestedFeatures.includes(item));
  if (addedFeatures.length) parts.push(`features noted: ${addedFeatures.join(", ")}`);
  const addedRoles = lead.usersAndRoles.filter((item) => !before.usersAndRoles.includes(item));
  if (addedRoles.length) parts.push(`users noted: ${addedRoles.join(", ")}`);
  if (lead.timelineText !== before.timelineText && lead.timelineText) parts.push(`timeline noted: ${lead.timelineText}`);
  if (lead.contact.email !== before.contact.email && lead.contact.email) parts.push("email noted");
  return parts.length ? `Understood — ${parts.join("; ")}.` : null;
}

function isKnowledgeQuestion(text: string) {
  return KNOWLEDGE_PATTERN.test(text) && !isProjectDirection(text) && !PRICING_PATTERN.test(text);
}

function pricingAnswer(lead: LeadRecord) {
  const next = nextMissingField(lead);
  const question = questionFor(next, lead);
  return `The cost depends on scope, workflows, user roles, integrations, data migration, design, and timeline. WebNexus prepares a tailored quote after the requirements are clear.${question ? ` ${question}` : ""}`;
}

function summarizeLead(lead: LeadRecord) {
  const parts = [
    lead.projectType && `project: ${projectLabel(lead.projectType)}`,
    lead.businessGoal && `goal: ${lead.businessGoal}`,
    lead.usersAndRoles.length && `users: ${lead.usersAndRoles.join(", ")}`,
    lead.requestedFeatures.length && `features: ${lead.requestedFeatures.join(", ")}`,
    lead.timelineText && `timeline: ${lead.timelineText}`,
    lead.budgetText && `budget: ${lead.budgetText}`,
  ].filter((part): part is string => Boolean(part));
  return parts.length
    ? `Here is what I have so far — ${parts.join("; ")}.`
    : "We have not recorded a project scope yet.";
}

export function isLeadReadyForSubmission(lead: LeadRecord) {
  return isLeadEligibleForSubmission(lead);
}

export class SalesConversationManager {
  private readonly sessionQueues = new Map<string, Promise<void>>();
  private readonly outboxWorker: NotificationOutboxWorker;

  constructor(
    private readonly repository: LeadRepository,
    private readonly knowledgeAnswerer: KnowledgeAnswerer,
    notifier: LeadNotifier,
  ) {
    this.outboxWorker = new NotificationOutboxWorker(repository, notifier);
  }

  async handleTurn(sessionId: string, userText: string): Promise<SalesTurnResult> {
    return this.withSessionLock(sessionId, () => this.handleTurnUnlocked(sessionId, userText));
  }

  private async handleTurnUnlocked(sessionId: string, userText: string): Promise<SalesTurnResult> {
    const persistedTurn = await this.repository.transaction(sessionId, async (transaction) => {
      const lead = transaction.lead;
      const before = structuredClone(lead);
      appendTranscript(lead, "user", userText);

      const projectDirection = isProjectDirection(userText) && detectProjectType(userText);
      const activeQuoteReviewAnswer =
        lead.activeQuestionField === "quoteReview" &&
        /^(?:yes(?:,?\s*submit it)?|sure|okay|ok|prepare (?:a|the) quote|collect (?:my )?details|go ahead)[.! ]*$/i.test(
          userText.trim(),
        );
      const activeBudgetAnswer =
        lead.activeQuestionField === "budgetText" &&
        (Boolean(parseBudget(userText)) ||
          /\b(?:not sure|unknown|no (?:fixed )?budget|not decided|flexible)\b/i.test(userText));
      const pricing =
        PRICING_PATTERN.test(userText) && !activeBudgetAnswer && !activeQuoteReviewAnswer;
      const knowledgeQuestion = isKnowledgeQuestion(userText);
      const submitting = SUBMISSION_PATTERN.test(userText) && !activeQuoteReviewAnswer;
      const greeting = GREETING_PATTERN.test(userText);
      const summaryRequested = SUMMARY_PATTERN.test(userText);

      if (projectDirection || isCorrection(userText)) {
        applyExplicitUpdates(lead, userText);
      } else if (!pricing && !knowledgeQuestion && !submitting && !greeting && !summaryRequested) {
        const appliedActiveAnswer = applyActiveAnswer(lead, userText);
        applyExplicitUpdates(lead, userText);
        if (appliedActiveAnswer) lead.activeQuestionField = null;
      }

      if (lead.activeQuestionField === "consent" && CONSENT_PATTERN.test(userText)) {
        lead.consentToSubmit = true;
        lead.consentAt = new Date().toISOString();
        markAnswered(lead, "consent");
        recordChange(lead, "consent", "granted");
        lead.activeQuestionField = null;
      }

      advancePhase(lead);
      let directAnswer: string | null = null;
      let usedKnowledge = false;

      if (lead.status === "submitted" && submitting && lead.backendLeadReference) {
        directAnswer = `This quote request was already submitted. Reference: ${lead.backendLeadReference}.`;
      } else if (summaryRequested) {
        directAnswer = summarizeLead(lead);
      } else if (greeting) {
        directAnswer = "Hi! I can help scope a project, answer portfolio questions, or prepare a quote request. What would you like to build or improve?";
      } else if (pricing) {
        directAnswer = pricingAnswer(lead);
      } else if (knowledgeQuestion) {
        directAnswer = await this.knowledgeAnswerer(userText, lead);
        usedKnowledge = Boolean(directAnswer);
      }

      const confirmed = confirmation(lead, before);
      if (
        (submitting || lead.consentToSubmit) &&
        isLeadReadyForSubmission(lead) &&
        lead.status !== "submitted"
      ) {
        const prepared = await transaction.prepareSubmission();
        lead.lastConfirmedSummary = confirmed;
        return { prepared, confirmed, usedKnowledge, answer: null };
      }

      const next = lead.status === "submitted" ? null : nextMissingField(lead);
      lead.activeQuestionField = next;
      const nextQuestion = directAnswer || questionFor(next, lead);
      const answer =
        [confirmed, nextQuestion]
          .filter((item): item is string => Boolean(item))
          .join("\n\n") || "How can WebNexus help with your project?";
      lead.lastConfirmedSummary = confirmed;
      appendTranscript(lead, "assistant", answer);
      return { prepared: null, confirmed, usedKnowledge, answer };
    });

    if (!persistedTurn.value.prepared) {
      return {
        answer: persistedTurn.value.answer!,
        lead: persistedTurn.lead,
        usedKnowledge: persistedTurn.value.usedKnowledge,
      };
    }

    const delivery = await this.outboxWorker.processOutbox(
      persistedTurn.value.prepared.outboxId,
    );
    const finalized = await this.repository.transaction(sessionId, async ({ lead }) => {
      const directAnswer = delivery.ok
        ? `Your quote request has been submitted successfully. Reference: ${delivery.leadReference}. The WebNexus team will review the requirements and contact you through the email provided.`
        : "I collected your project details, but the quote request could not be submitted. It has not been marked as sent. Please try again or contact WebNexus directly at hello@webnexus.dev.";
      const next = lead.status === "submitted" ? null : nextMissingField(lead);
      lead.activeQuestionField = next;
      const answer = [persistedTurn.value.confirmed, directAnswer]
        .filter((item): item is string => Boolean(item))
        .join("\n\n");
      lead.lastConfirmedSummary = persistedTurn.value.confirmed;
      appendTranscript(lead, "assistant", answer);
      return answer;
    });
    return {
      answer: finalized.value,
      lead: finalized.lead,
      usedKnowledge: persistedTurn.value.usedKnowledge,
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

  async submitLead(sessionId: string) {
    return this.withSessionLock(sessionId, async () => {
      const existing = await this.repository.getBySession(sessionId);
      if (!existing) {
        return { ok: false as const, status: 404, error: "No project conversation was found." };
      }
      if (!isLeadReadyForSubmission(existing)) {
        return {
          ok: false as const,
          status: 422,
          error: "The project scope, contact details, or explicit consent are incomplete.",
        };
      }
      if (existing.status === "submitted" && existing.backendLeadReference) {
        return { ok: true as const, status: 200, lead: existing };
      }
      const prepared = await this.repository.transaction(sessionId, (transaction) =>
        transaction.prepareSubmission(),
      );
      const delivery = await this.outboxWorker.processOutbox(prepared.value.outboxId);
      const lead = await this.repository.getBySession(sessionId);
      if (!lead) {
        return { ok: false as const, status: 503, error: "The saved lead could not be reloaded." };
      }
      return delivery.ok
        ? { ok: true as const, status: 200, lead }
        : { ok: false as const, status: 503, error: delivery.error, lead };
    });
  }
}

export function createSalesConversationManager(
  repository: LeadRepository,
  knowledgeAnswerer: KnowledgeAnswerer,
  notifier: LeadNotifier,
) {
  return new SalesConversationManager(repository, knowledgeAnswerer, notifier);
}
