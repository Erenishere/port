"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  ChevronDown,
  Mail,
  MessageCircle,
  RotateCcw,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { sendChat, type Message, type Source } from "@/lib/chat";
import { buildChatEmailHref } from "@/lib/chat-email";
import { CONTACT_EMAIL } from "@/lib/contact-email";

type ChatMessage = Message & {
  id: string;
  sources?: Source[];
};

function renderLinkedText(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g);

  return parts.map((part, index) => {
    if (/^https?:\/\//.test(part)) {
      const cleanUrl = part.replace(/[.,)]$/, "");
      const trailing = part.slice(cleanUrl.length);

      return (
        <span key={part + index}>
          <a href={cleanUrl} target="_blank" rel="noreferrer">
            {cleanUrl}
          </a>
          {trailing}
        </span>
      );
    }

    if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(part)) {
      return (
        <a key={part + index} href={`mailto:${part}`}>
          {part}
        </a>
      );
    }

    return part;
  });
}

const starterPrompts = [
  "Show me the featured ERP",
  "What AI work have you built?",
  "Which services do you offer?",
];

const initialMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi — I’m the WebNexus assistant. Ask about services, projects, tech stacks, pricing, or tell me what you want to build and I’ll help scope the right path.",
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [sending, setSending] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    messageEndRef.current?.scrollIntoView({ block: "nearest" });
    inputRef.current?.focus({ preventScroll: true });
  }, [messages, open, sending]);

  useEffect(() => {
    return () => requestRef.current?.abort();
  }, []);

  const submitMessage = async (rawMessage: string) => {
    const query = rawMessage.trim();
    if (!query || sending) return;

    const userMessage: ChatMessage = {
      id: "user-" + messages.length,
      role: "user",
      content: query,
    };
    const history = messages.map(({ role, content }) => ({ role, content }));

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setSending(true);

    const controller = new AbortController();
    requestRef.current = controller;

    try {
      const response = await sendChat(
        query,
        history,
        controller.signal,
        messages.length === 1,
      );
      setMessages((current) => [
        ...current,
        {
          id: "assistant-" + (messages.length + 1),
          role: "assistant",
          content: response.answer,
          sources: response.sources,
        },
      ]);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;

      setMessages((current) => [
        ...current,
        {
          id: "assistant-error-" + (messages.length + 1),
          role: "assistant",
          content:
            "I couldn’t reach the assistant service just now. Please try again, or ask how to order so I can guide you to the matching Fiverr service.",
        },
      ]);
    } finally {
      requestRef.current = null;
      setSending(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitMessage(input);
  };

  const startNewConversation = () => {
    requestRef.current?.abort();
    setMessages([initialMessage]);
    setInput("");
    setSending(false);
  };

  const emailChatHref = buildChatEmailHref(messages, CONTACT_EMAIL);
  const hasConversation = messages.some((message) => message.role === "user");

  return (
    <aside className="ink-chat" aria-label="WebNexus portfolio assistant">
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            className="ink-chat-bubble"
            initial={{ opacity: 0, y: 18, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.9 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setOpen(true)}
            aria-label="Open WebNexus assistant"
          >
            <span className="ink-chat-bot" aria-hidden="true">
              <span className="ink-chat-bot__face">
                <i />
                <i />
              </span>
            </span>
            <span className="ink-chat-bubble__pulse" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section
            className="ink-chat-panel"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            aria-label="Chat with the WebNexus assistant"
          >
            <header className="ink-chat-panel__header">
              <div className="ink-chat-panel__brand">
                <span className="ink-chat-panel__icon">
                  <span className="ink-chat-bot ink-chat-bot--small" aria-hidden="true">
                    <span className="ink-chat-bot__face">
                      <i />
                      <i />
                    </span>
                  </span>
                </span>
                <span>
                  <strong>WebNexus Assistant</strong>
                  <small><i /> Project discovery</small>
                </span>
              </div>
              <button
                type="button"
                className="ink-chat-panel__close"
                onClick={startNewConversation}
                aria-label="Start a new chat"
                title="Start a new chat"
              >
                <RotateCcw size={16} />
              </button>
              <button
                type="button"
                className="ink-chat-panel__close"
                onClick={() => setOpen(false)}
                aria-label="Close WebNexus assistant"
              >
                <ChevronDown size={18} />
              </button>
            </header>

            <div className="ink-chat-panel__body">
              <div
                className="ink-chat-messages"
                role="log"
                aria-live="polite"
                aria-relevant="additions"
              >
                {messages.map((message) => (
                  <div
                    className={"ink-chat-msg ink-chat-msg--" + message.role}
                    key={message.id}
                  >
                    <div className="ink-chat-msg__avatar" aria-hidden="true">
                      {message.role === "assistant" ? (
                        <Bot size={14} />
                      ) : (
                        <UserRound size={14} />
                      )}
                    </div>
                    <div className="ink-chat-msg__content">
                      <div className="ink-chat-msg__bubble">
                        {message.content.split("\n\n").map((paragraph, index) => (
                          <p key={paragraph + index}>{renderLinkedText(paragraph)}</p>
                        ))}
                      </div>
                      {message.sources && message.sources.length > 0 && (
                        <ul className="ink-chat-sources" aria-label="Answer sources">
                          {message.sources.slice(0, 3).map((source, index) => (
                            <li key={source.document_name + "-" + source.source + "-" + index}>
                              {source.source || source.document_name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}

                {messages.length === 1 && (
                  <div className="ink-chat-suggestions" aria-label="Suggested questions">
                    <p className="ink-chat-suggestions__label">Try asking</p>
                    <div>
                      {starterPrompts.map((prompt) => (
                        <button
                          type="button"
                          className="ink-chat-chip"
                          key={prompt}
                          onClick={() => void submitMessage(prompt)}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {sending && (
                  <div
                    className="ink-chat-msg ink-chat-msg--assistant"
                    aria-label="Assistant is thinking"
                  >
                    <div className="ink-chat-msg__avatar" aria-hidden="true">
                      <Bot size={14} />
                    </div>
                    <div className="ink-chat-msg__bubble">
                      <span className="ink-chat-typing" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    </div>
                  </div>
                )}
                <div ref={messageEndRef} />
              </div>

              <div className="ink-chat-composer-wrap">
                <form className="ink-chat-form" onSubmit={handleSubmit}>
                  <input
                    ref={inputRef}
                    id="portfolio-chat-message"
                    aria-label="Ask about WebNexus services"
                    className="ink-chat-input"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ask about projects, pricing, or ordering..."
                    maxLength={600}
                    autoComplete="off"
                    disabled={sending}
                  />
                  <button
                    className="ink-chat-send"
                    type="submit"
                    disabled={sending || !input.trim()}
                    aria-label="Send message"
                  >
                    <Send size={16} />
                  </button>
                </form>
                <p className="ink-chat-scope-note">
                  <ShieldCheck size={12} /> Matching gig only when the service is clear
                </p>
              </div>
            </div>

            <footer className="ink-chat-panel__footer">
              <MessageCircle size={14} />
              <span>Ask how to order and I’ll share only the matching Fiverr service.</span>
              <a
                className="ink-chat-mail ink-chat-mail--history"
                href={emailChatHref}
                aria-label={
                  hasConversation
                    ? "Email this chat history to WebNexus"
                    : "Email a project quote request to WebNexus"
                }
              >
                <Mail size={13} />
                {hasConversation ? "Email chat" : "Email project"}
              </a>
            </footer>
          </motion.section>
        )}
      </AnimatePresence>
    </aside>
  );
}
