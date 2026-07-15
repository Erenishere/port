export const SALES_PHASES = [
  "discover",
  "qualify",
  "scope",
  "quote_request",
  "contact_capture",
  "submitted",
] as const;

export type SalesPhase = (typeof SALES_PHASES)[number];

export const LEAD_STATUSES = [
  "new",
  "in_progress",
  "qualified",
  "awaiting_contact",
  "ready_to_submit",
  "submitted",
  "submission_failed",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const PROJECT_TYPES = [
  "erp",
  "web_app",
  "ai_assistant",
  "app_rescue",
  "api_backend",
  "dashboard",
  "other",
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export type LeadField =
  | "projectType"
  | "businessGoal"
  | "usersAndRoles"
  | "requestedFeatures"
  | "currentSystem"
  | "currentSystemProblems"
  | "integrations"
  | "dataSources"
  | "stackPreference"
  | "timelineText"
  | "budgetText"
  | "quoteReview"
  | "contactName"
  | "contactEmail"
  | "consent";

export type ContactInformation = {
  name: string | null;
  email: string | null;
  company: string | null;
  phone: string | null;
};

export type TranscriptMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type FieldChange = {
  field: LeadField;
  value: string;
  source: "explicit_user" | "normalized" | "system";
  createdAt: string;
};

export type LeadRecord = {
  id: string;
  sessionId: string;
  version: number;
  phase: SalesPhase;
  status: LeadStatus;
  projectType: ProjectType | null;
  businessGoal: string | null;
  usersAndRoles: string[];
  requestedFeatures: string[];
  currentSystem: string | null;
  currentSystemProblems: string[];
  integrations: string[];
  dataSources: string[];
  stackPreference: string[];
  budgetText: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetCurrency: string | null;
  timelineText: string | null;
  contact: ContactInformation;
  consentToSubmit: boolean;
  consentAt: string | null;
  activeQuestionField: LeadField | null;
  answeredFields: LeadField[];
  lastConfirmedSummary: string | null;
  transcript: TranscriptMessage[];
  fieldChanges: FieldChange[];
  submissionAttempts: number;
  backendLeadReference: string | null;
  submissionError: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
};

export function createLead(sessionId: string): LeadRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    sessionId,
    version: 0,
    phase: "discover",
    status: "new",
    projectType: null,
    businessGoal: null,
    usersAndRoles: [],
    requestedFeatures: [],
    currentSystem: null,
    currentSystemProblems: [],
    integrations: [],
    dataSources: [],
    stackPreference: [],
    budgetText: null,
    budgetMin: null,
    budgetMax: null,
    budgetCurrency: null,
    timelineText: null,
    contact: { name: null, email: null, company: null, phone: null },
    consentToSubmit: false,
    consentAt: null,
    activeQuestionField: null,
    answeredFields: [],
    lastConfirmedSummary: null,
    transcript: [],
    fieldChanges: [],
    submissionAttempts: 0,
    backendLeadReference: null,
    submissionError: null,
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
  };
}

export function hasAnswered(lead: LeadRecord, field: LeadField) {
  return lead.answeredFields.includes(field);
}

export function markAnswered(lead: LeadRecord, field: LeadField) {
  if (!lead.answeredFields.includes(field)) lead.answeredFields.push(field);
}

export function recordChange(
  lead: LeadRecord,
  field: LeadField,
  value: string,
  source: FieldChange["source"] = "explicit_user",
) {
  lead.fieldChanges.push({ field, value, source, createdAt: new Date().toISOString() });
}

export function isLeadEligibleForSubmission(lead: LeadRecord) {
  return Boolean(
    lead.projectType &&
      lead.businessGoal &&
      lead.requestedFeatures.length &&
      lead.timelineText &&
      lead.contact.name &&
      lead.contact.email &&
      hasAnswered(lead, "quoteReview") &&
      lead.consentToSubmit &&
      lead.consentAt,
  );
}
