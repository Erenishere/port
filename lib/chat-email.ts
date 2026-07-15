import type { Message } from "./chat";

const MAX_TRANSCRIPT_LENGTH = 4_000;

function transcript(messages: Message[]) {
  const body = messages
    .map((message) => {
      const sender = message.role === "user" ? "Visitor" : "WebNexus Assistant";
      return `${sender}: ${message.content.trim()}`;
    })
    .join("\n\n");

  if (body.length <= MAX_TRANSCRIPT_LENGTH) return body;
  return `${body.slice(0, MAX_TRANSCRIPT_LENGTH).trim()}\n\n[Chat history shortened for email.]`;
}

export function buildChatEmailHref(messages: Message[], recipient: string) {
  const subject = "Project quote request — WebNexus chat";
  const body = [
    "Hello WebNexus,",
    "",
    "I would like a quote for the project discussed in this chat.",
    "",
    "Chat history:",
    transcript(messages),
  ].join("\n");

  return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
