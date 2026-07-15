import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Braces,
  Bug,
  ChartNoAxesCombined,
  Code2,
  Crosshair,
  Database,
  DraftingCompass,
  Gauge,
  Layers,
  MonitorCog,
  PenTool,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
  Wrench,
} from "lucide-react";

/* ─── Types ─── */
export type Pillar = {
  title: string;
  tagline: string;
  copy: string;
  icon: LucideIcon;
};

export type Service = {
  title: string;
  verb: string;
  copy: string;
  icon: LucideIcon;
  details: string[];
};

export type Project = {
  title: string;
  category: string;
  description: string;
  role: string;
  stack: string[];
  features: string[];
  artifact: {
    code: string;
    mark: string;
    label: string;
    status: string;
    metrics: { label: string; value: string }[];
    signals: string[];
  };
  featured?: boolean;
  liveUrl?: string;
};

export type ProcessStep = {
  title: string;
  copy: string;
  icon: LucideIcon;
};

export type ProofItem = {
  title: string;
  copy: string;
  icon: LucideIcon;
};

/* ─── Navigation ─── */
export const navItems = [
  { label: "Journey", href: "#arrival" },
  { label: "Services", href: "#forge" },
  { label: "Projects", href: "#proof" },
  { label: "Process", href: "#path" },
  { label: "Contact", href: "#resolution" },
];

/* ─── Chapter 3 — Thread: Philosophy Pillars ─── */
export const pillars: Pillar[] = [
  {
    title: "Precision",
    tagline: "Every detail matters",
    copy: "Interfaces, schemas, and flows are sharpened until the system feels inevitable.",
    icon: Crosshair,
  },
  {
    title: "Discipline",
    tagline: "Calm cadence of craft",
    copy: "Every build gets a calm cadence: define, compose, test, refine, launch.",
    icon: ShieldCheck,
  },
  {
    title: "Clarity",
    tagline: "Complex made readable",
    copy: "Complex business logic becomes readable dashboards, clean journeys, and useful decisions.",
    icon: Sparkles,
  },
  {
    title: "Reliability",
    tagline: "The quiet work matters",
    copy: "Responsive states, edge cases, performance, and supportable code — the quiet work matters.",
    icon: Gauge,
  },
];

/* ─── Chapter 4 — Forge: Services ─── */
export const services: Service[] = [
  {
    title: "Product Builds",
    verb: "Build",
    copy: "Modern web apps, MVPs, dashboards, portals, and internal tools built from clean foundations.",
    icon: Code2,
    details: ["Next.js applications", "MERN products", "Admin portals"],
  },
  {
    title: "Business Systems",
    verb: "Systemize",
    copy: "Operational workflows translated into ERP-style modules, data models, and role-aware screens.",
    icon: Workflow,
    details: ["Inventory flows", "Approvals", "Reporting layers"],
  },
  {
    title: "Rescue Missions",
    verb: "Repair",
    copy: "Broken features, slow pages, brittle APIs, and confusing UX brought back into working order.",
    icon: Wrench,
    details: ["Bug fixing", "Performance passes", "Code cleanup"],
  },
  {
    title: "AI Enhancements",
    verb: "Enhance",
    copy: "Practical AI features embedded where they save real effort, from copilots to document workflows.",
    icon: Bot,
    details: ["AI integrations", "Automation", "Search and summaries"],
  },
];

/* ─── Chapter 5 — Proof: Projects ─── */
export const projects: Project[] = [
  {
    title: "Pharmaceutical Distribution ERP",
    category: "Enterprise ERP / Business Management System",
    description:
      "A live pharmaceutical distribution ERP that centralizes inventory, purchasing, sales, suppliers, customers, reporting, and operational workflows.",
    role:
      "Worked across Angular frontend modules, REST APIs, MongoDB schemas, business validation, workflow improvements, dashboards, and performance optimization.",
    stack: ["Angular 18", "Node.js", "Express.js", "MongoDB", "REST APIs"],
    features: [
      "Inventory and stock management",
      "Purchase and sales workflows",
      "Customer and supplier management",
      "Role-based access",
      "Reports and dashboards",
      "Business validations",
      "Pharmaceutical distribution workflows",
    ],
    artifact: {
      code: "PDE / ERP 01",
      mark: "Rx",
      label: "Distribution control",
      status: "Live system",
      metrics: [
        { label: "Inventory", value: "Stock" },
        { label: "Workflows", value: "Buy · Sell" },
        { label: "Access", value: "RBAC" },
      ],
      signals: [
        "Purchasing and sales connected",
        "Business rules validated",
        "Operational dashboards active",
      ],
    },
    featured: true,
    liveUrl: "https://phrama-frontend.vercel.app/",
  },
  {
    title: "Enterprise Voice RAG Assistant",
    category: "AI Knowledge Management",
    description:
      "A voice-enabled enterprise AI assistant that answers employee questions from internal policies, procedures, and PDF documents using retrieval-augmented generation.",
    role:
      "Built the backend pipeline, hybrid retrieval system, document search, WebSocket chat, session management, voice transcription, query classification, and response controls.",
    stack: ["Python", "FastAPI", "ChromaDB", "Groq", "Whisper", "WebSockets"],
    features: [
      "41 PDF knowledge documents",
      "Five company departments",
      "Semantic and BM25 search",
      "Reciprocal Rank Fusion",
      "Voice transcription",
      "Source-grounded answers",
      "Session history",
      "Small-talk classification",
      "Hallucination controls",
    ],
    artifact: {
      code: "RAG / VOICE 02",
      mark: "AI",
      label: "Knowledge retrieval",
      status: "Source grounded",
      metrics: [
        { label: "Documents", value: "41" },
        { label: "Departments", value: "05" },
        { label: "Retrieval", value: "Hybrid" },
      ],
      signals: [
        "Semantic and BM25 search",
        "Reciprocal Rank Fusion",
        "Voice and session pipeline",
      ],
    },
  },
  {
    title: "Crime Reporting and Case Management System",
    category: "Role-Based Management Platform",
    description:
      "A secure platform where citizens submit crime reports, officers manage investigations, and administrators control users and system records.",
    role:
      "Developed authentication, role-based controllers, case workflows, database operations, dashboards, and administrative functionality.",
    stack: ["ASP.NET MVC", "C#", "SQL Server", "HTML", "CSS", "JavaScript"],
    features: [
      "Citizen, officer, and admin roles",
      "Incident reporting",
      "Case assignment",
      "Case status tracking",
      "Session authentication",
      "Password hashing",
      "Administrative dashboard",
      "SQL database integration",
    ],
    artifact: {
      code: "CMS / CASE 03",
      mark: "CM",
      label: "Case workflow",
      status: "Access controlled",
      metrics: [
        { label: "User roles", value: "03" },
        { label: "Auth", value: "Session" },
        { label: "Database", value: "SQL" },
      ],
      signals: [
        "Incident intake recorded",
        "Cases assigned and tracked",
        "Administration secured",
      ],
    },
  },
];

/* ─── Chapter 6 — Path: Process Steps ─── */
export const processSteps: ProcessStep[] = [
  {
    title: "Discover",
    copy: "Find the true workflow, users, constraints, and business pressure behind the request.",
    icon: Search,
  },
  {
    title: "Architect",
    copy: "Shape the data model, navigation, component boundaries, and delivery milestones.",
    icon: DraftingCompass,
  },
  {
    title: "Design",
    copy: "Turn rough requirements into usable screens with rhythm, hierarchy, and state coverage.",
    icon: PenTool,
  },
  {
    title: "Develop",
    copy: "Build in typed layers, wire APIs carefully, and keep the UI responsive while it grows.",
    icon: Braces,
  },
  {
    title: "Refine & Launch",
    copy: "Polish the details, verify the build, document the path, and release with confidence.",
    icon: Rocket,
  },
];

/* ─── Proof Items ─── */
export const proofItems: ProofItem[] = [
  {
    title: "Web Apps",
    copy: "Responsive products with clean navigation and focused flows.",
    icon: MonitorCog,
  },
  {
    title: "Business Systems",
    copy: "ERP-like modules, approvals, inventory, and reporting surfaces.",
    icon: Database,
  },
  {
    title: "Bug Resolution",
    copy: "Root-cause fixes that improve both the code and the experience.",
    icon: Bug,
  },
  {
    title: "AI Integrations",
    copy: "Assistive features that reduce repetition and expose useful context.",
    icon: Bot,
  },
  {
    title: "MVPs",
    copy: "Lean builds that are structured enough to survive iteration.",
    icon: Layers,
  },
  {
    title: "Dashboards",
    copy: "Scanning, comparison, and decision-making interfaces.",
    icon: ChartNoAxesCombined,
  },
];

export const craftMetrics = [
  { value: "7", label: "Story chapters" },
  { value: "100%", label: "Code-driven visuals" },
  { value: "4", label: "Core service paths" },
  { value: "1", label: "Focused builder" },
];
