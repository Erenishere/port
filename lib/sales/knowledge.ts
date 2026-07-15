import { retrieveWebNexusKnowledge } from "@/lib/webnexus-knowledge";
import type { LeadRecord } from "./lead";

export async function answerPortfolioQuestion(query: string, lead: LeadRecord) {
  void lead;
  const normalized = query.toLowerCase();

  if (/\b(?:ai work|ai project|rag|voice assistant)\b/.test(normalized)) {
    return "WebNexus built an Enterprise Voice RAG Assistant for internal policies and PDF documents. It combines semantic and BM25 retrieval, source-grounded answers, voice transcription, session history, and response controls.";
  }
  if (/\b(?:featured )?(?:erp|pharmaceutical|distribution)\b/.test(normalized)) {
    return "The featured Pharmaceutical Distribution ERP centralizes inventory, purchasing, sales, suppliers, customers, reporting, role-based access, and business validations. It uses Angular 18, Node.js, Express.js, MongoDB, and REST APIs.";
  }
  if (/\b(?:services?|what can you do)\b/.test(normalized)) {
    return "WebNexus provides product builds, business systems, app rescue work, and practical AI enhancements—including web apps, ERP-style workflows, dashboards, APIs, performance work, and document-based AI assistants.";
  }
  if (/\b(?:database|databases)\b/.test(normalized)) {
    return "WebNexus works with MongoDB, PostgreSQL, MySQL, SQL Server, and ChromaDB, selected according to the product and workflow needs.";
  }
  if (/\b(?:backend|api)\b/.test(normalized)) {
    return "WebNexus works with Node.js, Express.js, ASP.NET MVC, .NET Core, REST APIs, and WebSockets for backend and integration work.";
  }
  if (/\b(?:process|delivery)\b/.test(normalized)) {
    return "The delivery path is discovery, architecture, interface design, development, refinement, and launch—with progress shaped around the actual workflow and scope.";
  }
  if (/\b(?:integrate|integration).{0,40}\bai\b|\bai\b.{0,40}\b(?:integrate|integration)\b/.test(normalized)) {
    return "Yes. WebNexus can integrate AI into a new or existing website or web app using approved website content, PDFs, APIs, or internal business data.";
  }

  const knowledge = await retrieveWebNexusKnowledge(query);
  if (!knowledge) return null;
  return "I found approved WebNexus information relevant to that question. I can help apply it to your project scope, or you can ask about services, projects, technology, or delivery.";
}
