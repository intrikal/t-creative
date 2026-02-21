"use client";

import { useState } from "react";
import {
  Search,
  MessageSquare,
  ShoppingBag,
  Clock,
  Mail,
  Phone,
  CheckCheck,
  Archive,
  ChevronRight,
  Tag,
  DollarSign,
  Instagram,
  Globe,
  Users,
  Star,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog, Field, Input, Textarea } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & mock data                                                  */
/* ------------------------------------------------------------------ */

type InquiryStatus = "new" | "read" | "replied" | "archived";
type ProductInquiryStatus = "pending" | "quoted" | "accepted" | "declined" | "completed";
type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting";
type InquirySource = "instagram" | "google" | "referral" | "website" | "word_of_mouth" | "tiktok";

interface GeneralInquiry {
  id: number;
  name: string;
  initials: string;
  email: string;
  phone?: string;
  interest: ServiceCategory;
  source?: InquirySource;
  message: string;
  receivedAt: string;
  status: InquiryStatus;
  converted?: boolean; // Did this lead to a booking?
  priority?: boolean;
}

const MOCK_GENERAL: GeneralInquiry[] = [
  {
    id: 1,
    name: "Jordan Lee",
    initials: "JL",
    email: "jordan@example.com",
    phone: "(404) 555-0301",
    interest: "lash",
    source: "instagram",
    message:
      "Hi! I'm interested in a full set of volume lashes for my graduation next month. Do you have availability in late March? I've been following your page for a while and love your work!",
    receivedAt: "1 hour ago",
    status: "new",
    priority: true,
  },
  {
    id: 2,
    name: "Camille Foster",
    initials: "CF",
    email: "camille@example.com",
    interest: "jewelry",
    source: "instagram",
    message:
      "Do you do matching sets? I'd love permanent jewelry for me and my sister as a birthday gift. We're both interested in delicate chains.",
    receivedAt: "3 hours ago",
    status: "new",
  },
  {
    id: 3,
    name: "Marcus Webb",
    initials: "MW",
    email: "marcus@example.com",
    phone: "(404) 555-0303",
    interest: "consulting",
    source: "referral",
    message:
      "I'm launching a beauty brand and need help structuring HR processes for a small team of 5. I was referred by Denise Carter and would love to set up a discovery call.",
    receivedAt: "Yesterday",
    status: "read",
    priority: true,
  },
  {
    id: 4,
    name: "Simone Davis",
    initials: "SD",
    email: "simone@example.com",
    interest: "lash",
    source: "google",
    message:
      "Can I get a classic lash fill? I'm currently going to another studio but want to switch. Found you on Google and your reviews are amazing.",
    receivedAt: "Yesterday",
    status: "replied",
    converted: true,
  },
  {
    id: 5,
    name: "Brittany Hall",
    initials: "BH",
    email: "brittany@example.com",
    interest: "crochet",
    source: "tiktok",
    message:
      "How long does a crochet braid install take? And do you provide the hair or do I bring my own?",
    receivedAt: "2 days ago",
    status: "replied",
    converted: false,
  },
  {
    id: 6,
    name: "Layla Martin",
    initials: "LM",
    email: "layla@example.com",
    interest: "jewelry",
    source: "website",
    message: "I'm looking for a permanent anklet. Do you carry rose gold options?",
    receivedAt: "3 days ago",
    status: "archived",
  },
  {
    id: 7,
    name: "Denise Carter",
    initials: "DC",
    email: "denise@example.com",
    phone: "(404) 555-0307",
    interest: "consulting",
    source: "word_of_mouth",
    message:
      "I need help building out an employee handbook for my growing salon. Can we schedule a discovery call this week?",
    receivedAt: "4 days ago",
    status: "read",
    priority: true,
  },
  {
    id: 8,
    name: "Whitney Brooks",
    initials: "WB",
    email: "whitney@example.com",
    interest: "lash",
    source: "instagram",
    message:
      "What's the difference between classic, hybrid, and volume lashes? I've never had them done before and want to make sure I pick the right style.",
    receivedAt: "5 days ago",
    status: "replied",
    converted: true,
  },
];

interface ProductInquiry {
  id: number;
  name: string;
  initials: string;
  email: string;
  phone?: string;
  product: string;
  category: ServiceCategory;
  message: string;
  receivedAt: string;
  status: ProductInquiryStatus;
  budget?: string;
  quoteAmount?: string;
  assignedTo?: string;
  followUpDate?: string;
}

const MOCK_PRODUCTS: ProductInquiry[] = [
  {
    id: 1,
    name: "Aisha Thomas",
    initials: "AT",
    email: "aisha@example.com",
    phone: "(404) 555-0401",
    product: "Custom Crochet Set — 26 Passion Twists",
    category: "crochet",
    message:
      "I'd like a custom order in burgundy and auburn. How long is the wait time? I need them before Feb 28.",
    receivedAt: "2 hours ago",
    status: "pending",
    budget: "$120–150",
    assignedTo: "Maya",
    followUpDate: "Feb 24",
  },
  {
    id: 2,
    name: "Renee Jackson",
    initials: "RJ",
    email: "renee@example.com",
    product: "Permanent Jewelry Gift Box",
    category: "jewelry",
    message:
      "Looking to order 3 gift sets for bridesmaids. Can you do custom packaging with our names on the boxes?",
    receivedAt: "Yesterday",
    status: "quoted",
    budget: "$250+",
    quoteAmount: "$285",
    assignedTo: "Jade",
    followUpDate: "Feb 25",
  },
  {
    id: 3,
    name: "Monique Green",
    initials: "MG",
    email: "monique@example.com",
    product: "Custom Crochet Updo",
    category: "crochet",
    message:
      "I need a crochet updo for a wedding in April. What styles do you recommend for a formal look?",
    receivedAt: "2 days ago",
    status: "accepted",
    assignedTo: "Maya",
  },
  {
    id: 4,
    name: "Tamara Price",
    initials: "TP",
    email: "tamara@example.com",
    product: "Lash Extension Aftercare Kit",
    category: "lash",
    message:
      "Can I order 10 kits in bulk for a beauty school gift bag? Would love a discount if possible.",
    receivedAt: "3 days ago",
    status: "completed",
    quoteAmount: "$180",
    assignedTo: "Trini",
  },
  {
    id: 5,
    name: "Felicia Young",
    initials: "FY",
    email: "felicia@example.com",
    product: "Custom Training Materials",
    category: "consulting",
    message:
      "Do you sell your training curriculum for lash technicians separately? Looking for a complete package.",
    receivedAt: "4 days ago",
    status: "declined",
  },
];

/* ------------------------------------------------------------------ */
/*  Config helpers                                                      */
/* ------------------------------------------------------------------ */

const CATEGORY_COLOR: Record<ServiceCategory, { bg: string; text: string; dot: string }> = {
  lash: { bg: "bg-[#c4907a]/15", text: "text-[#96604a]", dot: "bg-[#c4907a]" },
  jewelry: { bg: "bg-[#d4a574]/15", text: "text-[#a07040]", dot: "bg-[#d4a574]" },
  crochet: { bg: "bg-[#7ba3a3]/15", text: "text-[#5b8a8a]", dot: "bg-[#7ba3a3]" },
  consulting: { bg: "bg-[#5b8a8a]/15", text: "text-[#3d6464]", dot: "bg-[#5b8a8a]" },
};

const AVATAR_COLOR: Record<ServiceCategory, string> = {
  lash: "bg-[#c4907a] text-white",
  jewelry: "bg-[#d4a574] text-white",
  crochet: "bg-[#7ba3a3] text-white",
  consulting: "bg-[#5b8a8a] text-white",
};

function statusBadge(status: InquiryStatus) {
  switch (status) {
    case "new":
      return { label: "New", cls: "bg-blush/15 text-[#96604a] border-blush/25 font-semibold" };
    case "read":
      return { label: "Read", cls: "bg-foreground/8 text-muted border-foreground/12" };
    case "replied":
      return { label: "Replied", cls: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "archived":
      return { label: "Archived", cls: "bg-foreground/5 text-muted/50 border-foreground/8" };
  }
}

function productStatusBadge(status: ProductInquiryStatus) {
  switch (status) {
    case "pending":
      return {
        label: "Pending",
        cls: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20 font-semibold",
      };
    case "quoted":
      return { label: "Quoted", cls: "bg-foreground/8 text-foreground border-foreground/15" };
    case "accepted":
      return { label: "Accepted", cls: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "declined":
      return { label: "Declined", cls: "bg-destructive/10 text-destructive border-destructive/20" };
    case "completed":
      return { label: "Completed", cls: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
  }
}

const SOURCE_ICON: Record<InquirySource, React.ReactNode> = {
  instagram: <Instagram className="w-3 h-3" />,
  tiktok: <Star className="w-3 h-3" />,
  google: <Globe className="w-3 h-3" />,
  referral: <Users className="w-3 h-3" />,
  website: <Globe className="w-3 h-3" />,
  word_of_mouth: <Users className="w-3 h-3" />,
};

const SOURCE_LABEL: Record<InquirySource, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  google: "Google",
  referral: "Referral",
  website: "Website",
  word_of_mouth: "Word of Mouth",
};

const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  lash: "Lash",
  jewelry: "Jewelry",
  crochet: "Crochet",
  consulting: "Consulting",
};

/* ------------------------------------------------------------------ */
/*  Detail Dialog                                                      */
/* ------------------------------------------------------------------ */

function GeneralDetailDialog({
  inquiry,
  onClose,
  onMarkRead,
  onArchive,
}: {
  inquiry: GeneralInquiry | null;
  onClose: () => void;
  onMarkRead: (id: number) => void;
  onArchive: (id: number) => void;
}) {
  const [replyText, setReplyText] = useState("");
  if (!inquiry) return null;
  const cat = CATEGORY_COLOR[inquiry.interest];
  const sb = statusBadge(inquiry.status);

  return (
    <Dialog open={!!inquiry} onClose={onClose} title={inquiry.name} size="lg">
      <div className="space-y-4">
        {/* Contact info row */}
        <div className="flex flex-wrap gap-3 text-xs text-muted">
          <a
            href={`mailto:${inquiry.email}`}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            {inquiry.email}
          </a>
          {inquiry.phone && (
            <a
              href={`tel:${inquiry.phone}`}
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              {inquiry.phone}
            </a>
          )}
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {inquiry.receivedAt}
          </span>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border", sb.cls)}>
            {sb.label}
          </span>
          <span
            className={cn(
              "text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1",
              cat.bg,
              cat.text,
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", cat.dot)} />
            {CATEGORY_LABEL[inquiry.interest]}
          </span>
          {inquiry.source && (
            <span className="text-[11px] text-muted flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/60">
              {SOURCE_ICON[inquiry.source]}
              {SOURCE_LABEL[inquiry.source]}
            </span>
          )}
          {inquiry.priority && (
            <span className="text-[11px] text-[#d4a574] bg-[#d4a574]/10 border border-[#d4a574]/20 px-2 py-0.5 rounded-full">
              ★ Priority
            </span>
          )}
          {inquiry.converted !== undefined && (
            <span
              className={cn(
                "text-[11px] px-2 py-0.5 rounded-full border",
                inquiry.converted
                  ? "text-[#4e6b51] bg-[#4e6b51]/10 border-[#4e6b51]/20"
                  : "text-muted bg-foreground/5 border-foreground/10",
              )}
            >
              {inquiry.converted ? "Converted to booking" : "No booking yet"}
            </span>
          )}
        </div>

        {/* Full message */}
        <div className="bg-surface rounded-xl p-4 border border-border/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Message</p>
          <p className="text-sm text-foreground leading-relaxed">{inquiry.message}</p>
        </div>

        {/* Quick reply */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
            Quick Reply
          </p>
          <Textarea
            rows={3}
            placeholder="Type a reply…"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 flex-wrap">
          <a
            href={`mailto:${inquiry.email}${replyText ? `?body=${encodeURIComponent(replyText)}` : ""}`}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" /> Reply via Email
          </a>
          {inquiry.phone && (
            <a
              href={`tel:${inquiry.phone}`}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border text-xs font-medium text-foreground rounded-lg hover:bg-foreground/5 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" /> Call
            </a>
          )}
          {inquiry.status !== "read" && inquiry.status !== "replied" && (
            <button
              onClick={() => {
                onMarkRead(inquiry.id);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border text-xs font-medium text-foreground rounded-lg hover:bg-foreground/5 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark as Read
            </button>
          )}
          {inquiry.status !== "archived" && (
            <button
              onClick={() => {
                onArchive(inquiry.id);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border text-xs font-medium text-muted rounded-lg hover:bg-foreground/5 transition-colors"
            >
              <Archive className="w-3.5 h-3.5" /> Archive
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function ProductDetailDialog({
  inquiry,
  onClose,
}: {
  inquiry: ProductInquiry | null;
  onClose: () => void;
}) {
  const [quoteInput, setQuoteInput] = useState(inquiry?.quoteAmount ?? "");
  if (!inquiry) return null;
  const cat = CATEGORY_COLOR[inquiry.category];
  const sb = productStatusBadge(inquiry.status);

  return (
    <Dialog open={!!inquiry} onClose={onClose} title={inquiry.name} size="lg">
      <div className="space-y-4">
        {/* Contact */}
        <div className="flex flex-wrap gap-3 text-xs text-muted">
          <a
            href={`mailto:${inquiry.email}`}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            {inquiry.email}
          </a>
          {inquiry.phone && (
            <a
              href={`tel:${inquiry.phone}`}
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              {inquiry.phone}
            </a>
          )}
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {inquiry.receivedAt}
          </span>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border", sb.cls)}>
            {sb.label}
          </span>
          <span
            className={cn(
              "text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1",
              cat.bg,
              cat.text,
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", cat.dot)} />
            {CATEGORY_LABEL[inquiry.category]}
          </span>
          {inquiry.budget && (
            <span className="text-[11px] text-muted flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/60">
              <DollarSign className="w-3 h-3" />
              Budget: {inquiry.budget}
            </span>
          )}
          {inquiry.assignedTo && (
            <span className="text-[11px] text-muted flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/60">
              Assigned: {inquiry.assignedTo}
            </span>
          )}
          {inquiry.followUpDate && (
            <span className="text-[11px] text-[#d4a574] bg-[#d4a574]/10 border border-[#d4a574]/20 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Follow up {inquiry.followUpDate}
            </span>
          )}
        </div>

        {/* Product */}
        <div className="bg-surface rounded-xl p-4 border border-border/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
            Product / Service Requested
          </p>
          <p className="text-sm font-medium text-foreground">{inquiry.product}</p>
          <p className="text-sm text-muted mt-2 leading-relaxed">{inquiry.message}</p>
        </div>

        {/* Quote input */}
        {(inquiry.status === "pending" || inquiry.status === "quoted") && (
          <Field label="Quote Amount">
            <Input
              placeholder="e.g. $150"
              value={quoteInput}
              onChange={(e) => setQuoteInput(e.target.value)}
            />
          </Field>
        )}
        {inquiry.quoteAmount && inquiry.status !== "pending" && (
          <div className="flex items-center justify-between py-2 px-4 bg-[#4e6b51]/8 rounded-xl border border-[#4e6b51]/15">
            <span className="text-xs text-muted">Quoted amount</span>
            <span className="text-sm font-semibold text-[#4e6b51]">{inquiry.quoteAmount}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 flex-wrap">
          <a
            href={`mailto:${inquiry.email}`}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" /> Reply via Email
          </a>
          {inquiry.status === "pending" && (
            <>
              <button className="flex items-center gap-1.5 px-3 py-2 bg-[#4e6b51] text-white text-xs font-medium rounded-lg hover:bg-[#4e6b51]/90 transition-colors">
                <Tag className="w-3.5 h-3.5" /> Send Quote
              </button>
              <button className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-destructive/40 text-destructive text-xs font-medium rounded-lg hover:bg-destructive/5 transition-colors">
                Decline
              </button>
            </>
          )}
          {inquiry.status === "quoted" && (
            <button className="flex items-center gap-1.5 px-3 py-2 bg-[#4e6b51] text-white text-xs font-medium rounded-lg hover:bg-[#4e6b51]/90 transition-colors">
              <CheckCheck className="w-3.5 h-3.5" /> Mark Accepted
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function InquiriesPage() {
  const [tab, setTab] = useState<"general" | "products">("general");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedGeneral, setSelectedGeneral] = useState<GeneralInquiry | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductInquiry | null>(null);
  const [generalList, setGeneralList] = useState<GeneralInquiry[]>(MOCK_GENERAL);

  const generalFilters = ["All", "New", "Read", "Replied", "Archived"];
  const productFilters = ["All", "Pending", "Quoted", "Accepted", "Completed", "Declined"];
  const activeFilters = tab === "general" ? generalFilters : productFilters;

  const newCount = generalList.filter((i) => i.status === "new").length;
  const awaitingReply = generalList.filter((i) => i.status === "new" || i.status === "read").length;
  const pendingProductCount = MOCK_PRODUCTS.filter((i) => i.status === "pending").length;
  const convertedCount = generalList.filter((i) => i.converted).length;

  const filteredGeneral = generalList.filter((i) => {
    const matchSearch =
      !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.message.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || statusBadge(i.status).label === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredProducts = MOCK_PRODUCTS.filter((i) => {
    const matchSearch =
      !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.product.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "All" || productStatusBadge(i.status).label === statusFilter;
    return matchSearch && matchStatus;
  });

  function handleMarkRead(id: number) {
    setGeneralList((prev) => prev.map((i) => (i.id === id ? { ...i, status: "read" } : i)));
  }
  function handleArchive(id: number) {
    setGeneralList((prev) => prev.map((i) => (i.id === id ? { ...i, status: "archived" } : i)));
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Inquiries</h1>
        <p className="text-sm text-muted mt-0.5">
          {newCount} new contact · {pendingProductCount} pending product requests
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="gap-0 py-4">
          <div className="px-4">
            <p className="text-[10px] font-medium text-muted uppercase tracking-wide">
              New Inquiries
            </p>
            <p className="text-2xl font-semibold text-foreground mt-1 tabular-nums">{newCount}</p>
            <p className="text-xs text-[#c4907a] mt-1">Needs response</p>
          </div>
        </Card>
        <Card className="gap-0 py-4">
          <div className="px-4">
            <p className="text-[10px] font-medium text-muted uppercase tracking-wide">
              Awaiting Reply
            </p>
            <p className="text-2xl font-semibold text-foreground mt-1 tabular-nums">
              {awaitingReply}
            </p>
            <p className="text-xs text-[#d4a574] mt-1">New + read</p>
          </div>
        </Card>
        <Card className="gap-0 py-4">
          <div className="px-4">
            <p className="text-[10px] font-medium text-muted uppercase tracking-wide">
              Product Pending
            </p>
            <p className="text-2xl font-semibold text-foreground mt-1 tabular-nums">
              {pendingProductCount}
            </p>
            <p className="text-xs text-[#7a5c10] mt-1">Need quoting</p>
          </div>
        </Card>
        <Card className="gap-0 py-4">
          <div className="px-4">
            <p className="text-[10px] font-medium text-muted uppercase tracking-wide">Converted</p>
            <p className="text-2xl font-semibold text-foreground mt-1 tabular-nums">
              {convertedCount}
            </p>
            <p className="text-xs text-[#4e6b51] mt-1">Turned into bookings</p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => {
            setTab("general");
            setStatusFilter("All");
            setSearch("");
          }}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "general"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted hover:text-foreground",
          )}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Contact Form
          {newCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-blush/20 text-[#96604a] rounded-full">
              {newCount}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setTab("products");
            setStatusFilter("All");
            setSearch("");
          }}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "products"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted hover:text-foreground",
          )}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          Product Requests
          {pendingProductCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-[#7a5c10]/15 text-[#7a5c10] rounded-full">
              {pendingProductCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            type="text"
            placeholder={tab === "general" ? "Search name or message…" : "Search name or product…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground placeholder:text-muted"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {activeFilters.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                statusFilter === f
                  ? "bg-foreground text-background"
                  : "bg-surface border border-border text-muted hover:text-foreground hover:bg-foreground/5",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {tab === "general" ? (
        filteredGeneral.length === 0 ? (
          <div className="text-center py-16 text-muted text-sm">No inquiries found.</div>
        ) : (
          <div className="space-y-2">
            {filteredGeneral.map((inquiry) => {
              const sb = statusBadge(inquiry.status);
              const cat = CATEGORY_COLOR[inquiry.interest];
              const isNew = inquiry.status === "new";
              return (
                <div
                  key={inquiry.id}
                  onClick={() => setSelectedGeneral(inquiry)}
                  className={cn(
                    "group relative flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-sm",
                    isNew
                      ? "bg-background border-border"
                      : "bg-surface/50 border-border/60 hover:bg-surface",
                  )}
                >
                  {/* New dot */}
                  {isNew && (
                    <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[#c4907a]" />
                  )}

                  {/* Avatar */}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                      AVATAR_COLOR[inquiry.interest],
                    )}
                  >
                    {inquiry.initials}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap pr-6">
                      <span
                        className={cn(
                          "text-sm font-medium text-foreground",
                          isNew && "font-semibold",
                        )}
                      >
                        {inquiry.name}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                          sb.cls,
                        )}
                      >
                        {sb.label}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1",
                          cat.bg,
                          cat.text,
                        )}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full", cat.dot)} />
                        {CATEGORY_LABEL[inquiry.interest]}
                      </span>
                      {inquiry.priority && <span className="text-[10px] text-[#d4a574]">★</span>}
                      {inquiry.converted && (
                        <span className="text-[10px] text-[#4e6b51] bg-[#4e6b51]/10 px-1.5 py-0.5 rounded-full">
                          Booked ✓
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-muted">{inquiry.email}</span>
                      {inquiry.phone && (
                        <span className="text-[11px] text-muted hidden sm:inline">
                          {inquiry.phone}
                        </span>
                      )}
                      {inquiry.source && (
                        <span className="text-[11px] text-muted flex items-center gap-1 hidden sm:flex">
                          {SOURCE_ICON[inquiry.source]}
                          {SOURCE_LABEL[inquiry.source]}
                        </span>
                      )}
                    </div>

                    <p
                      className={cn(
                        "text-xs mt-1.5 line-clamp-2 leading-relaxed",
                        isNew ? "text-foreground/80" : "text-muted/80",
                      )}
                    >
                      {inquiry.message}
                    </p>

                    <p className="text-[10px] text-muted/50 mt-1.5 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {inquiry.receivedAt}
                    </p>
                  </div>

                  {/* Hover actions */}
                  <div className="absolute right-3 bottom-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={`mailto:${inquiry.email}`}
                      onClick={(e) => e.stopPropagation()}
                      title="Reply"
                      className="p-1.5 rounded-lg bg-background border border-border text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </a>
                    {inquiry.status !== "read" && inquiry.status !== "replied" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkRead(inquiry.id);
                        }}
                        title="Mark as read"
                        className="p-1.5 rounded-lg bg-background border border-border text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {inquiry.status !== "archived" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchive(inquiry.id);
                        }}
                        title="Archive"
                        className="p-1.5 rounded-lg bg-background border border-border text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <span className="p-1.5 text-muted">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-16 text-muted text-sm">No product inquiries found.</div>
      ) : (
        <div className="space-y-2">
          {filteredProducts.map((inquiry) => {
            const sb = productStatusBadge(inquiry.status);
            const cat = CATEGORY_COLOR[inquiry.category];
            const isPending = inquiry.status === "pending";
            return (
              <div
                key={inquiry.id}
                onClick={() => setSelectedProduct(inquiry)}
                className={cn(
                  "group relative flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-sm",
                  isPending
                    ? "bg-background border-border"
                    : "bg-surface/50 border-border/60 hover:bg-surface",
                )}
              >
                {isPending && (
                  <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[#d4a574]" />
                )}

                {/* Avatar */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                    AVATAR_COLOR[inquiry.category],
                  )}
                >
                  {inquiry.initials}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap pr-6">
                    <span
                      className={cn(
                        "text-sm font-medium text-foreground",
                        isPending && "font-semibold",
                      )}
                    >
                      {inquiry.name}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                        sb.cls,
                      )}
                    >
                      {sb.label}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1",
                        cat.bg,
                        cat.text,
                      )}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full", cat.dot)} />
                      {CATEGORY_LABEL[inquiry.category]}
                    </span>
                    {inquiry.budget && (
                      <span className="text-[10px] text-muted flex items-center gap-0.5">
                        <DollarSign className="w-3 h-3" />
                        {inquiry.budget}
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-medium text-foreground/80 mt-0.5">{inquiry.product}</p>

                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px] text-muted">{inquiry.email}</span>
                    {inquiry.assignedTo && (
                      <span className="text-[11px] text-muted hidden sm:inline">
                        → {inquiry.assignedTo}
                      </span>
                    )}
                    {inquiry.followUpDate && (
                      <span className="text-[11px] text-[#d4a574] flex items-center gap-0.5 hidden sm:flex">
                        <Clock className="w-2.5 h-2.5" />
                        Follow up {inquiry.followUpDate}
                      </span>
                    )}
                  </div>

                  <p
                    className={cn(
                      "text-xs mt-1.5 line-clamp-2 leading-relaxed",
                      isPending ? "text-foreground/80" : "text-muted/80",
                    )}
                  >
                    {inquiry.message}
                  </p>

                  <div className="flex items-center gap-3 mt-1.5">
                    <p className="text-[10px] text-muted/50 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {inquiry.receivedAt}
                    </p>
                    {inquiry.quoteAmount && (
                      <p className="text-[10px] text-[#4e6b51] font-medium">
                        Quoted {inquiry.quoteAmount}
                      </p>
                    )}
                  </div>
                </div>

                {/* Hover actions */}
                <div className="absolute right-3 bottom-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={`mailto:${inquiry.email}`}
                    onClick={(e) => e.stopPropagation()}
                    title="Reply"
                    className="p-1.5 rounded-lg bg-background border border-border text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                  </a>
                  <span className="p-1.5 text-muted">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail dialogs */}
      <GeneralDetailDialog
        inquiry={selectedGeneral}
        onClose={() => setSelectedGeneral(null)}
        onMarkRead={handleMarkRead}
        onArchive={handleArchive}
      />
      <ProductDetailDialog inquiry={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </div>
  );
}
