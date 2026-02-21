"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Message {
  id: number;
  from: "me" | "other";
  text: string;
  time: string;
}

interface Thread {
  id: number;
  name: string;
  initials: string;
  role: "admin" | "client";
  lastMessage: string;
  lastTime: string;
  unread: number;
  messages: Message[];
}

const THREADS: Thread[] = [
  {
    id: 1,
    name: "Trini",
    initials: "TC",
    role: "admin",
    lastMessage:
      "New lash glue protocol starting Monday — please review before your next appointment.",
    lastTime: "8:30 AM",
    unread: 2,
    messages: [
      {
        id: 1,
        from: "other",
        text: "Hey Jasmine! Great work this week — clients are loving the results.",
        time: "Feb 20, 4:00 PM",
      },
      {
        id: 2,
        from: "me",
        text: "Thank you! That means a lot. The new D curl trays are making such a difference.",
        time: "Feb 20, 4:15 PM",
      },
      {
        id: 3,
        from: "other",
        text: "Agreed! Also reminder — can you make sure to double-check the aftercare checklist before each appointment. Had a client with questions about aftercare that should have been covered at the booking.",
        time: "Feb 20, 5:00 PM",
      },
      {
        id: 4,
        from: "me",
        text: "Absolutely, I'll be more thorough. I'll review the protocol now.",
        time: "Feb 20, 5:10 PM",
      },
      {
        id: 5,
        from: "other",
        text: "New lash glue protocol starting Monday — please review the updated aftercare guide in Training before your next appointment.",
        time: "Today, 8:30 AM",
      },
      {
        id: 6,
        from: "other",
        text: "Also FYI — your 12pm today (Priya K.) is a new client. Full set. She found us on Instagram, tends to want a more dramatic look based on her inqury.",
        time: "Today, 8:35 AM",
      },
    ],
  },
  {
    id: 2,
    name: "Maya R.",
    initials: "MR",
    role: "client",
    lastMessage: "Thank you so much!! I love them 😭",
    lastTime: "11:45 AM",
    unread: 1,
    messages: [
      {
        id: 1,
        from: "other",
        text: "Hi Jasmine! Just wanted to say my lashes still look amazing after 3 weeks. You did such a clean job!",
        time: "Feb 10, 9:00 AM",
      },
      {
        id: 2,
        from: "me",
        text: "Aw I'm so glad! Make sure you're using the foam cleanser and spoolie every day 😊",
        time: "Feb 10, 9:30 AM",
      },
      {
        id: 3,
        from: "other",
        text: "I am!! Should I book my fill for the 21st?",
        time: "Feb 10, 9:32 AM",
      },
      {
        id: 4,
        from: "me",
        text: "Yes perfect timing — 3 weeks exactly. I'll see you then!",
        time: "Feb 10, 9:40 AM",
      },
      { id: 5, from: "other", text: "Thank you so much!! I love them 😭", time: "Today, 11:45 AM" },
    ],
  },
  {
    id: 3,
    name: "Priya K.",
    initials: "PK",
    role: "client",
    lastMessage: "Amazing, see you then!",
    lastTime: "Yesterday",
    unread: 0,
    messages: [
      {
        id: 1,
        from: "other",
        text: "Hi! I booked a full set for Saturday. Do I need to come with no makeup?",
        time: "Feb 19, 2:00 PM",
      },
      {
        id: 2,
        from: "me",
        text: "Yes please! Come with clean lashes and no eye makeup. Also no mascara for 24hrs before. See you Saturday 😊",
        time: "Feb 19, 2:20 PM",
      },
      { id: 3, from: "other", text: "Amazing, see you then!", time: "Feb 19, 2:25 PM" },
    ],
  },
  {
    id: 4,
    name: "Chloe T.",
    initials: "CT",
    role: "client",
    lastMessage: "Perfect, I'll be there!",
    lastTime: "Feb 19",
    unread: 0,
    messages: [
      {
        id: 1,
        from: "other",
        text: "Hey Jasmine, I need to move my appointment from 1pm to 2:30pm if possible?",
        time: "Feb 19, 10:00 AM",
      },
      {
        id: 2,
        from: "me",
        text: "Of course! Updated — see you at 2:30 😊",
        time: "Feb 19, 10:15 AM",
      },
      { id: 3, from: "other", text: "Perfect, I'll be there!", time: "Feb 19, 10:18 AM" },
    ],
  },
];

export function AssistantMessagesPage() {
  const [activeThread, setActiveThread] = useState<Thread>(THREADS[0]);
  const [input, setInput] = useState("");
  const [threads, setThreads] = useState<Thread[]>(THREADS);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThread.id]);

  function send() {
    if (!input.trim()) return;
    const newMsg: Message = { id: Date.now(), from: "me", text: input.trim(), time: "Now" };
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id
          ? {
              ...t,
              messages: [...t.messages, newMsg],
              lastMessage: input.trim(),
              lastTime: "Now",
              unread: 0,
            }
          : t,
      ),
    );
    setActiveThread((t) => ({ ...t, messages: [...t.messages, newMsg], unread: 0 }));
    setInput("");
  }

  function selectThread(thread: Thread) {
    const cleared = { ...thread, unread: 0 };
    setThreads((prev) => prev.map((t) => (t.id === thread.id ? cleared : t)));
    setActiveThread(cleared);
  }

  return (
    <div className="flex h-full min-h-0" style={{ height: "calc(100vh - 48px)" }}>
      {/* Thread list */}
      <div className="w-64 shrink-0 border-r border-border flex flex-col hidden sm:flex">
        <div className="px-4 py-3 border-b border-border shrink-0">
          <h1 className="text-sm font-semibold text-foreground">Messages</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => selectThread(t)}
              className={cn(
                "w-full flex items-start gap-3 px-4 py-3 border-b border-border/40 hover:bg-surface/60 transition-colors text-left",
                activeThread.id === t.id && "bg-surface/80",
              )}
            >
              <Avatar size="sm">
                <AvatarFallback
                  className={cn(
                    "text-[10px] font-bold",
                    t.role === "admin" ? "bg-accent/15 text-accent" : "bg-surface text-muted",
                  )}
                >
                  {t.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-foreground truncate">{t.name}</span>
                  <span className="text-[10px] text-muted/60 shrink-0">{t.lastTime}</span>
                </div>
                <p className="text-[11px] text-muted truncate mt-0.5">{t.lastMessage}</p>
              </div>
              {t.unread > 0 && (
                <span className="shrink-0 w-4 h-4 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center">
                  {t.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="px-5 py-3 border-b border-border shrink-0 flex items-center gap-3">
          <Avatar size="sm">
            <AvatarFallback
              className={cn(
                "text-[10px] font-bold",
                activeThread.role === "admin"
                  ? "bg-accent/15 text-accent"
                  : "bg-surface text-muted",
              )}
            >
              {activeThread.initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-foreground">{activeThread.name}</p>
            <p className="text-[10px] text-muted capitalize">{activeThread.role}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {activeThread.messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex", msg.from === "me" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[70%] rounded-2xl px-3.5 py-2.5",
                  msg.from === "me"
                    ? "bg-accent text-white rounded-br-sm"
                    : "bg-surface border border-border text-foreground rounded-bl-sm",
                )}
              >
                <p className="text-sm leading-relaxed">{msg.text}</p>
                <p
                  className={cn(
                    "text-[10px] mt-1",
                    msg.from === "me" ? "text-white/60 text-right" : "text-muted",
                  )}
                >
                  {msg.time}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`Message ${activeThread.name}…`}
              className="flex-1 px-3.5 py-2 text-sm bg-surface border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
            />
            <button
              onClick={send}
              disabled={!input.trim()}
              className="w-9 h-9 rounded-xl bg-accent text-white flex items-center justify-center hover:bg-accent/90 transition-colors disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
