"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: number;
  from: "client" | "studio";
  text: string;
  time: string;
  read?: boolean;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 1,
    from: "studio",
    text: "Hi Maya! Thanks for booking with us. Just a reminder that your fill is coming up on Feb 28 at 10 AM. Let us know if you need to reschedule!",
    time: "Feb 20, 9:15 AM",
    read: true,
  },
  {
    id: 2,
    from: "client",
    text: "Thank you! I'll be there. Should I do anything to prep beforehand?",
    time: "Feb 20, 10:32 AM",
  },
  {
    id: 3,
    from: "studio",
    text: "Great! Just come with clean lashes — no mascara or eye makeup please. And avoid oil-based products the morning of. See you soon! ✨",
    time: "Feb 20, 11:04 AM",
    read: true,
  },
  {
    id: 4,
    from: "client",
    text: "Perfect, got it! Quick question — can I book a permanent jewelry appointment the same day?",
    time: "Feb 20, 11:15 AM",
  },
  {
    id: 5,
    from: "studio",
    text: "Absolutely! We can do the jewelry after your lash appointment. It's usually about 30 minutes. Want me to add it on?",
    time: "Feb 20, 11:30 AM",
    read: true,
  },
];

export function ClientMessagesPage() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    const now = new Date();
    const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), from: "client", text, time: `Feb 21, ${time}` },
    ]);
    setDraft("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-full max-h-screen">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">T Creative Studio</p>
            <p className="text-[11px] text-muted">Trini · Studio owner</p>
          </div>
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => {
          const isClient = msg.from === "client";
          return (
            <div
              key={msg.id}
              className={cn("flex gap-2", isClient ? "flex-row-reverse" : "flex-row")}
            >
              {!isClient && (
                <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-accent font-bold text-[9px]">TC</span>
                </div>
              )}
              <div className={cn("max-w-[75%] space-y-1", isClient ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    isClient
                      ? "bg-accent text-white rounded-tr-sm"
                      : "bg-surface border border-border text-foreground rounded-tl-sm",
                  )}
                >
                  {msg.text}
                </div>
                <p
                  className={cn(
                    "text-[10px] text-muted/60 px-1",
                    isClient ? "text-right" : "text-left",
                  )}
                >
                  {msg.time}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="px-4 py-3 border-t border-border bg-background shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message T Creative Studio..."
            rows={1}
            className="flex-1 resize-none text-sm text-foreground placeholder:text-muted/50 bg-surface border border-border rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-accent/40 max-h-32"
            style={{ overflow: "hidden" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!draft.trim()}
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
              draft.trim()
                ? "bg-accent text-white hover:bg-accent/90"
                : "bg-foreground/5 text-muted cursor-not-allowed",
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted/50 mt-1.5 px-1">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
