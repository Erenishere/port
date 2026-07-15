import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";

export const WEBNEXUS_KNOWLEDGE_DOCUMENT =
  "WebNexus_Website_Chatbot_Knowledge_Base.pdf";

export type KnowledgeSource = {
  source: string;
  department: string;
  document_name: string;
  relevance_score: number;
};

export type KnowledgeResult = {
  answer: string;
  context: Array<{ title: string; content: string; source: string }>;
  sources: KnowledgeSource[];
};

type Chunk = {
  title: string;
  text: string;
  page: number;
  endPage: number;
  tokens: string[];
  termFrequency: Map<string, number>;
};

type Index = {
  chunks: Chunk[];
  averageLength: number;
  documentFrequency: Map<string, number>;
  modifiedAt: number;
};

const PDF_PATH = join(process.cwd(), WEBNEXUS_KNOWLEDGE_DOCUMENT);
const HEADER_LINES = new Set([
  "WEBNEXUS | Portfolio and Services Knowledge Base",
  "WebNexus - Complexity entered. A clear system remains. |",
  "End of official WebNexus website chatbot knowledge base.",
]);
const STOP_WORDS = new Set(
  "a about all an and are as at be by can could current do does follow for from have how i in into is it me more my of on or our please question should show tell that the their this to topic up us we webnexus what when which who with work you your".split(
    " ",
  ),
);
const ALIASES: Record<string, string[]> = {
  backend: ["api", "nodejs", "express", "fastapi", "aspnet", "dotnet"],
  build: ["service", "system", "product", "development"],
  chatbot: ["assistant", "ai", "rag"],
  contact: ["email"],
  cost: ["pricing", "estimate"],
  database: ["mongodb", "mysql", "postgresql", "sql", "chromadb"],
  email: ["contact"],
  frontend: ["angular", "react", "nextjs", "typescript"],
  pdf: ["document", "rag"],
  price: ["pricing", "estimate"],
  rag: ["fastapi", "chromadb", "groq", "whisper", "websocket", "bm25"],
  erp: ["angular", "nodejs", "express", "mongodb"],
  crime: ["aspnet", "csharp", "sql"],
  technology: ["stack", "frontend", "backend", "database"],
};
const NAMED_HEADINGS = new Set([
  "Applied Intelligence",
  "Brand promise",
  "Business pressure",
  "Business Systems",
  "Canonical AI integration answer",
  "Canonical greeting",
  "Canonical project enquiry",
  "Canonical unsupported-information answer",
  "Contact",
  "Contribution",
  "Core capabilities",
  "Core statement",
  "How progress is communicated",
  "How RAG works",
  "How technology is selected",
  "Important limitation",
  "In-scope topics",
  "Modernization and App Rescue",
  "Outcome",
  "Out-of-scope handling",
  "Pricing and timeline",
  "Product Engineering",
  "Project overview",
  "Recommended chatbot response style",
  "Solution",
  "Source citations",
  "Source-of-truth rules",
  "Supported data sources",
  "System value",
  "Technology stack",
  "The WebNexus method",
  "Who WebNexus helps",
  "Why this project matters",
]);
const TABLE_HEADINGS = [
  "Backend and APIs",
  "Engineering tools",
  "AI and RAG",
  "Databases",
  "Frontend",
];

let cachedIndex: Index | null = null;
let loadingIndex: Promise<Index> | null = null;

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/node\.js/g, "nodejs")
    .replace(/next\.js/g, "nextjs")
    .replace(/asp\.net/g, "aspnet")
    .replace(/\.net\b/g, " dotnet ")
    .replace(/c#/g, "csharp")
    .replace(/[^a-z0-9+#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stem(token: string) {
  if (token.length > 4 && token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

function tokenize(value: string) {
  return normalize(value)
    .split(" ")
    .map(stem)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function queryTokens(value: string) {
  const original = tokenize(value);
  const expanded = new Set(original);
  for (const token of original) {
    for (const alias of ALIASES[token] ?? []) expanded.add(stem(alias));
  }
  if (/^(who are you|what is webnexus)\??$/i.test(value.trim())) {
    expanded.add("identity");
    expanded.add("positioning");
  }
  if (/\b(?:how much|price|pricing|cost|fee|quote)\b/i.test(value)) {
    expanded.add("pricing");
    expanded.add("estimate");
    expanded.add("cost");
  }
  return { original, expanded: [...expanded] };
}

function headingFromLine(line: string) {
  const question = line.match(/^Q:\s*(.+)$/i);
  if (question) return { title: question[1].trim(), body: "" };
  if (/^\d+\.\s+/.test(line) || (line.endsWith("?") && line.length < 120)) {
    return { title: line, body: "" };
  }
  if (NAMED_HEADINGS.has(line)) return { title: line, body: "" };
  for (const heading of TABLE_HEADINGS) {
    if (line === heading || line.startsWith(`${heading} `)) {
      return { title: heading, body: line.slice(heading.length).trim() };
    }
  }
  return null;
}

function cleanLines(page: string) {
  return page
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(
      (line) =>
        line &&
        !HEADER_LINES.has(line) &&
        line !== "Area Technologies and capabilities" &&
        line !== "Stage Purpose Typical output",
    );
}

export function buildKnowledgeChunks(pages: string[]) {
  const chunks: Array<{
    title: string;
    text: string;
    page: number;
    endPage: number;
  }> = [];
  let title = "WebNexus knowledge base";
  let body: string[] = [];
  let startPage = 1;
  let endPage = 1;

  const flush = () => {
    const text = body
      .join(" ")
      .replace(/^A:\s*/i, "")
      .replace(/([a-z])-\s+(?=[a-z])/gi, "$1-")
      .replace(/\s+([,;:?])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
    if (text) chunks.push({ title, text, page: startPage, endPage });
    body = [];
  };

  pages.forEach((pageText, index) => {
    const pageNumber = index + 1;
    for (const line of cleanLines(pageText)) {
      const heading = headingFromLine(line);
      if (heading) {
        flush();
        title = heading.title;
        body = heading.body ? [heading.body] : [];
        startPage = pageNumber;
        endPage = pageNumber;
        continue;
      }
      endPage = pageNumber;
      if (line.startsWith("")) {
        body.push(`• ${line.slice(1).trim()}`);
      } else if (body.at(-1)?.startsWith("• ")) {
        body[body.length - 1] += ` ${line}`;
      } else {
        body.push(line);
      }
    }
  });
  flush();
  return chunks;
}

function createIndex(pages: string[], modifiedAt: number): Index {
  const chunks = buildKnowledgeChunks(pages).map((chunk) => {
    const tokens = tokenize(`${chunk.title} ${chunk.title} ${chunk.text}`);
    const termFrequency = new Map<string, number>();
    for (const token of tokens) {
      termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
    }
    return { ...chunk, tokens, termFrequency };
  });
  const documentFrequency = new Map<string, number>();
  for (const chunk of chunks) {
    for (const token of new Set(chunk.tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  return {
    chunks,
    documentFrequency,
    averageLength:
      chunks.reduce((sum, chunk) => sum + chunk.tokens.length, 0) /
      Math.max(chunks.length, 1),
    modifiedAt,
  };
}

async function loadIndex() {
  const file = await stat(PDF_PATH);
  if (cachedIndex?.modifiedAt === file.mtimeMs) return cachedIndex;
  if (loadingIndex) return loadingIndex;
  loadingIndex = (async () => {
    const buffer = await readFile(PDF_PATH);
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf);
    return createIndex(text, file.mtimeMs);
  })()
    .then((index) => {
      cachedIndex = index;
      return index;
    })
    .finally(() => {
      loadingIndex = null;
    });
  return loadingIndex;
}

function search(index: Index, query: string, limit: number) {
  const { original, expanded } = queryTokens(query);
  if (!expanded.length) return [];
  const normalizedQuery = normalize(query);
  const followUp = query.match(/\nFollow-up question:\s*(.+)$/i)?.[1] ?? "";
  const followUpTokens = tokenize(followUp);
  const count = index.chunks.length;
  const k1 = 1.35;
  const b = 0.72;

  return index.chunks
    .map((chunk) => {
      let score = 0;
      for (const token of expanded) {
        const frequency = chunk.termFrequency.get(token) ?? 0;
        if (!frequency) continue;
        const documentFrequency = index.documentFrequency.get(token) ?? 0;
        const inverseFrequency = Math.log(
          1 + (count - documentFrequency + 0.5) / (documentFrequency + 0.5),
        );
        const lengthAdjustment =
          k1 *
          (1 -
            b +
            b * (chunk.tokens.length / Math.max(index.averageLength, 1)));
        score +=
          inverseFrequency *
          ((frequency * (k1 + 1)) / (frequency + lengthAdjustment));
      }
      const title = normalize(chunk.title);
      const searchable = normalize(`${chunk.title} ${chunk.text}`);
      const covered = original.filter((token) => searchable.includes(token));
      score += (covered.length / Math.max(original.length, 1)) * 3;

      if (followUpTokens.length) {
        const followUpCoverage = followUpTokens.filter((token) =>
          searchable.includes(token),
        );
        score +=
          (followUpCoverage.length / Math.max(followUpTokens.length, 1)) * 5;
      }
      if (
        followUpTokens.some((token) => token === "stack" || token === "technology") &&
        title.includes("technology stack")
      ) {
        score += 12;
      }
      if (/\b(?:tell me more|more details|explain)\b/i.test(followUp) && title === "project overview") {
        score += 10;
      }

      if (title === normalizedQuery) score += 18;
      else if (
        normalizedQuery.length > 5 &&
        (title.includes(normalizedQuery) || normalizedQuery.includes(title))
      ) {
        score += 8;
      }
      return { ...chunk, score };
    })
    .filter((match) => match.score >= 1.5)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function sourceLabel(match: { page: number; endPage: number; title: string }) {
  const pages =
    match.page === match.endPage
      ? `Page ${match.page}`
      : `Pages ${match.page}-${match.endPage}`;
  return `${pages} · ${match.title}`;
}

function answerText(text: string) {
  const answer = text.replace(/\s*•\s*/g, "\n\n• ").trim();
  if (answer.length <= 1_200) return answer;
  const shortened = answer.slice(0, 1_200);
  const sentenceEnd = Math.max(
    shortened.lastIndexOf(". "),
    shortened.lastIndexOf("? "),
  );
  return `${shortened.slice(0, sentenceEnd > 700 ? sentenceEnd + 1 : 1_200).trim()}…`;
}

export async function retrieveWebNexusKnowledge(
  query: string,
  limit = 3,
): Promise<KnowledgeResult | null> {
  const matches = search(await loadIndex(), query, limit);
  if (!matches.length) return null;
  const topScore = matches[0].score;
  const seenSourceLabels = new Set<string>();
  const visibleMatches = matches
    .filter((match, index) => index === 0 || match.score / topScore >= 0.35)
    .filter((match) => {
      const label = sourceLabel(match);
      if (seenSourceLabels.has(label)) return false;
      seenSourceLabels.add(label);
      return true;
    });
  return {
    answer: answerText(matches[0].text),
    context: matches.map((match) => ({
      title: match.title,
      content: match.text,
      source: sourceLabel(match),
    })),
    sources: visibleMatches.map((match) => ({
      source: sourceLabel(match),
      department: "WebNexus portfolio",
      document_name: WEBNEXUS_KNOWLEDGE_DOCUMENT,
      relevance_score: Number((match.score / topScore).toFixed(3)),
    })),
  };
}
