export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type Source = {
  source: string;
  department: string;
  document_name: string;
  relevance_score: number;
};

export type ChatResponse = {
  answer: string;
  sources: Source[];
  rewritten_query: string;
  mode?: "rag" | "local" | "guard" | "sales";
  restricted?: boolean;
  rag_used?: boolean;
  lead?: {
    phase: string;
    status: string;
    project_type: string | null;
    active_question_field: string | null;
  };
};

export async function sendChat(
  query: string,
  history: Message[] = [],
  signal?: AbortSignal,
  startNewConversation = false,
): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      history: history.slice(-8),
      start_new: startNewConversation,
    }),
    signal,
  });

  if (!res.ok) throw new Error(`Chat API error: ${res.status}`);
  return res.json();
}
