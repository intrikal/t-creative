"use client";

import { useState } from "react";
import {
  Search,
  Send,
  Paperclip,
  MoreVertical,
  ArrowLeft,
  Filter,
  MessageSquare,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Mock data                                                           */
/* ------------------------------------------------------------------ */

type MessageStatus = "new" | "read" | "replied" | "archived";
type MessageChannel = "website" | "instagram" | "sms" | "email";
type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting" | "training" | "events";

interface Message {
  id: number;
  sender: "client" | "trini";
  text: string;
  time: string;
}

interface Conversation {
  id: number;
  name: string;
  initials: string;
  channel: MessageChannel;
  interest: ServiceCategory;
  preview: string;
  time: string;
  status: MessageStatus;
  unread: number;
  messages: Message[];
}

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 1,
    name: "Jordan Lee",
    initials: "JL",
    channel: "website",
    interest: "lash",
    preview: "Hi! I'm interested in a full set of volume lashes…",
    time: "1h ago",
    status: "new",
    unread: 2,
    messages: [
      {
        id: 1,
        sender: "client",
        text: "Hi! I'm interested in a full set of volume lashes for my graduation next month. Do you have availability in late March?",
        time: "10:12 AM",
      },
      { id: 2, sender: "client", text: "Also, do you offer a student discount?", time: "10:14 AM" },
    ],
  },
  {
    id: 2,
    name: "Camille Foster",
    initials: "CF",
    channel: "instagram",
    interest: "jewelry",
    preview: "Do you do matching sets? I'd love permanent jewelry…",
    time: "3h ago",
    status: "new",
    unread: 1,
    messages: [
      {
        id: 1,
        sender: "client",
        text: "Do you do matching sets? I'd love permanent jewelry for me and my sister as a birthday gift.",
        time: "8:45 AM",
      },
    ],
  },
  {
    id: 3,
    name: "Marcus Webb",
    initials: "MW",
    channel: "email",
    interest: "consulting",
    preview: "I'm launching a beauty brand and need help…",
    time: "Yesterday",
    status: "replied",
    unread: 0,
    messages: [
      {
        id: 1,
        sender: "client",
        text: "I'm launching a beauty brand and need help structuring HR processes for a small team of 5.",
        time: "Yesterday, 2:30 PM",
      },
      {
        id: 2,
        sender: "trini",
        text: "Hi Marcus! That sounds like an exciting venture. I'd love to schedule a discovery call. Are you available this week?",
        time: "Yesterday, 4:00 PM",
      },
      {
        id: 3,
        sender: "client",
        text: "Yes! Thursday at 3 PM works great for me.",
        time: "Yesterday, 4:45 PM",
      },
    ],
  },
  {
    id: 4,
    name: "Aisha Rahman",
    initials: "AR",
    channel: "sms",
    interest: "lash",
    preview: "Can I reschedule my appointment from Friday to…",
    time: "Yesterday",
    status: "read",
    unread: 0,
    messages: [
      {
        id: 1,
        sender: "client",
        text: "Hi Trini! Can I reschedule my appointment from Friday to next Monday instead?",
        time: "Yesterday, 11:00 AM",
      },
    ],
  },
  {
    id: 5,
    name: "Destiny Cruz",
    initials: "DC",
    channel: "instagram",
    interest: "jewelry",
    preview: "OMG your work is so beautiful! How much for a…",
    time: "2 days ago",
    status: "replied",
    unread: 0,
    messages: [
      {
        id: 1,
        sender: "client",
        text: "OMG your work is so beautiful! How much for a permanent ankle bracelet?",
        time: "2 days ago, 6:20 PM",
      },
      {
        id: 2,
        sender: "trini",
        text: "Thank you so much! 🥰 Permanent ankle bracelets start at $65. DM me to book!",
        time: "2 days ago, 7:00 PM",
      },
    ],
  },
  {
    id: 6,
    name: "Priya Kapoor",
    initials: "PK",
    channel: "website",
    interest: "training",
    preview: "I saw your lash training program — when is the…",
    time: "3 days ago",
    status: "archived",
    unread: 0,
    messages: [
      {
        id: 1,
        sender: "client",
        text: "I saw your lash training program — when is the next cohort starting?",
        time: "3 days ago, 9:15 AM",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function channelBadge(channel: MessageChannel) {
  switch (channel) {
    case "website":
      return { label: "Web", className: "bg-foreground/8 text-muted border-foreground/12" };
    case "instagram":
      return { label: "IG", className: "bg-pink-50 text-pink-700 border-pink-100" };
    case "sms":
      return { label: "SMS", className: "bg-blue-50 text-blue-700 border-blue-100" };
    case "email":
      return { label: "Email", className: "bg-amber-50 text-amber-700 border-amber-100" };
  }
}

function statusDot(status: MessageStatus) {
  switch (status) {
    case "new":
      return "bg-blush";
    case "read":
      return "bg-foreground/20";
    case "replied":
      return "bg-[#4e6b51]";
    case "archived":
      return "bg-transparent";
  }
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

export function MessagesPage() {
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [filter, setFilter] = useState<"all" | "new" | "replied" | "archived">("all");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");

  const filtered = MOCK_CONVERSATIONS.filter((c) => {
    if (filter !== "all" && c.status !== filter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalUnread = MOCK_CONVERSATIONS.reduce((sum, c) => sum + c.unread, 0);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* ── Inbox list ────────────────────────────────────────────── */}
      <div
        className={cn(
          "w-full lg:w-80 xl:w-96 border-r border-border flex flex-col shrink-0",
          selected ? "hidden lg:flex" : "flex",
        )}
      >
        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-semibold text-foreground tracking-tight">Messages</h1>
              {totalUnread > 0 && <p className="text-xs text-muted mt-0.5">{totalUnread} unread</p>}
            </div>
            <button className="p-2 rounded-lg hover:bg-foreground/5 text-muted transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
            <input
              type="text"
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-surface border border-border rounded-lg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 mt-3">
            {(["all", "new", "replied", "archived"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "flex-1 py-1 text-[11px] font-medium rounded-md capitalize transition-colors",
                  filter === f
                    ? "bg-foreground/8 text-foreground"
                    : "text-muted hover:text-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {filtered.length === 0 && (
            <p className="text-sm text-muted text-center py-10">No conversations found.</p>
          )}
          {filtered.map((conv) => {
            const ch = channelBadge(conv.channel);
            return (
              <button
                key={conv.id}
                onClick={() => setSelected(conv)}
                className={cn(
                  "w-full text-left px-4 py-3.5 hover:bg-foreground/3 transition-colors flex gap-3",
                  selected?.id === conv.id && "bg-foreground/5",
                )}
              >
                <div className="relative shrink-0 mt-0.5">
                  <Avatar size="sm">
                    <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                      {conv.initials}
                    </AvatarFallback>
                  </Avatar>
                  {conv.unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-blush text-white text-[9px] font-bold flex items-center justify-center">
                      {conv.unread}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-sm font-medium truncate",
                        conv.unread > 0 ? "text-foreground" : "text-foreground/80",
                      )}
                    >
                      {conv.name}
                    </span>
                    <span className="text-[10px] text-muted shrink-0">{conv.time}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusDot(conv.status))}
                    />
                    <Badge
                      className={cn("border text-[9px] px-1 py-0 leading-4 shrink-0", ch.className)}
                    >
                      {ch.label}
                    </Badge>
                    <p className="text-xs text-muted truncate">{conv.preview}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Thread view ───────────────────────────────────────────── */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Thread header */}
          <div className="px-5 py-4 border-b border-border flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 rounded-lg hover:bg-foreground/5 text-muted"
              onClick={() => setSelected(null)}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <Avatar size="sm">
              <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                {selected.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{selected.name}</p>
              <div className="flex items-center gap-2">
                <Badge
                  className={cn(
                    "border text-[10px] px-1.5 py-0.5",
                    channelBadge(selected.channel).className,
                  )}
                >
                  {channelBadge(selected.channel).label}
                </Badge>
                <span className="text-xs text-muted capitalize">{selected.interest}</span>
              </div>
            </div>
            <button className="p-2 rounded-lg hover:bg-foreground/5 text-muted">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {selected.messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2.5",
                  msg.sender === "trini" ? "flex-row-reverse" : "flex-row",
                )}
              >
                {msg.sender === "client" && (
                  <Avatar size="sm" className="shrink-0 mt-0.5">
                    <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                      {selected.initials}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    "max-w-[72%]",
                    msg.sender === "trini" ? "items-end" : "items-start",
                    "flex flex-col gap-1",
                  )}
                >
                  <div
                    className={cn(
                      "px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                      msg.sender === "trini"
                        ? "bg-accent text-white rounded-tr-sm"
                        : "bg-surface text-foreground rounded-tl-sm border border-border",
                    )}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-muted px-1">{msg.time}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Compose */}
          <div className="px-5 py-4 border-t border-border">
            <div className="flex items-end gap-2">
              <button className="p-2 text-muted hover:text-foreground transition-colors shrink-0">
                <Paperclip className="w-4 h-4" />
              </button>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message…"
                rows={1}
                className="flex-1 resize-none bg-surface border border-border rounded-xl px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30 max-h-32 overflow-y-auto"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    setDraft("");
                  }
                }}
              />
              <button
                disabled={!draft.trim()}
                className="p-2.5 rounded-xl bg-accent text-white hover:bg-accent/90 disabled:opacity-40 transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty state on desktop */
        <div className="hidden lg:flex flex-1 items-center justify-center text-center">
          <div>
            <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6 text-muted" />
            </div>
            <p className="text-sm font-medium text-foreground">Select a conversation</p>
            <p className="text-xs text-muted mt-1">
              Choose a message from the inbox to read and reply.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
