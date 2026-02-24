/**
 * Client component for the Inquiries dashboard.
 *
 * Renders a two-tab interface — "Contact Form" (general inquiries) and
 * "Product Requests" — with search, status filtering, and stat cards.
 *
 * **Exported helpers** (consumed by detail dialogs):
 * - `CATEGORY_COLOR`, `CATEGORY_LABEL` — interest/category → colour/label maps
 * - `SOURCE_ICON`, `SOURCE_LABEL` — inquiry source metadata
 * - `statusBadge()`, `productStatusBadge()` — status → {label, className} for badges
 *
 * **Exported types**: `GeneralInquiry`, `ProductInquiry`
 *
 * Data arrives as serialised `InquiryRow[]` / `ProductInquiryRow[]` from the
 * server component and is mapped to richer client types via `mapInquiry()` and
 * `mapProductInquiry()` (computed initials, relative timestamps, category mapping).
 *
 * CRUD handlers call server actions from `./actions.ts` and trigger
 * `router.refresh()` to re-fetch from the server component.
 *
 * @module inquiries/InquiriesPage
 * @see {@link ./actions.ts} — server actions
 * @see {@link ./components/GeneralDetailDialog.tsx}
 * @see {@link ./components/ProductDetailDialog.tsx}
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  MessageSquare,
  ShoppingBag,
  Clock,
  Mail,
  CheckCheck,
  Archive,
  ChevronRight,
  DollarSign,
  Instagram,
  Globe,
  Users,
  Star,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { InquiryRow, ProductInquiryRow } from "./actions";
import {
  updateInquiryStatus,
  replyToInquiry,
  updateProductInquiryStatus,
  sendProductQuote,
} from "./actions";
import { GeneralDetailDialog } from "./components/GeneralDetailDialog";
import { ProductDetailDialog } from "./components/ProductDetailDialog";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type InquiryStatus = "new" | "read" | "replied" | "archived";
type ProductInquiryStatus = "new" | "contacted" | "quote_sent" | "in_progress" | "completed";
type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting";
type InquirySource = "instagram" | "google" | "referral" | "website" | "word_of_mouth" | "tiktok";

export interface GeneralInquiry {
  id: number;
  name: string;
  initials: string;
  email: string;
  phone: string | null;
  interest: ServiceCategory | null;
  source?: InquirySource;
  message: string;
  receivedAt: string;
  status: InquiryStatus;
  staffReply: string | null;
}

export interface ProductInquiry {
  id: number;
  name: string;
  initials: string;
  email: string;
  phone: string | null;
  product: string;
  category: ServiceCategory | null;
  message: string | null;
  customizations: string | null;
  receivedAt: string;
  status: ProductInquiryStatus;
  quantity: number;
  quotedInCents: number | null;
}

/* ------------------------------------------------------------------ */
/*  Config helpers (exported for dialog components)                     */
/* ------------------------------------------------------------------ */

export const CATEGORY_COLOR: Record<ServiceCategory, { bg: string; text: string; dot: string }> = {
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

export function statusBadge(status: InquiryStatus) {
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

export function productStatusBadge(status: ProductInquiryStatus) {
  switch (status) {
    case "new":
      return {
        label: "New",
        cls: "bg-blush/15 text-[#96604a] border-blush/25 font-semibold",
      };
    case "contacted":
      return { label: "Contacted", cls: "bg-foreground/8 text-foreground border-foreground/15" };
    case "quote_sent":
      return { label: "Quoted", cls: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
    case "in_progress":
      return { label: "In Progress", cls: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "completed":
      return { label: "Completed", cls: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
  }
}

export const SOURCE_ICON: Record<InquirySource, React.ReactNode> = {
  instagram: <Instagram className="w-3 h-3" />,
  tiktok: <Star className="w-3 h-3" />,
  google: <Globe className="w-3 h-3" />,
  referral: <Users className="w-3 h-3" />,
  website: <Globe className="w-3 h-3" />,
  word_of_mouth: <Users className="w-3 h-3" />,
};

export const SOURCE_LABEL: Record<InquirySource, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  google: "Google",
  referral: "Referral",
  website: "Website",
  word_of_mouth: "Word of Mouth",
};

export const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  lash: "Lash",
  jewelry: "Jewelry",
  crochet: "Crochet",
  consulting: "Consulting",
};

/* ------------------------------------------------------------------ */
/*  Mappers                                                            */
/* ------------------------------------------------------------------ */

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function mapInquiry(r: InquiryRow): GeneralInquiry {
  return {
    id: r.id,
    name: r.name,
    initials: initials(r.name),
    email: r.email,
    phone: r.phone,
    interest: r.interest,
    message: r.message,
    receivedAt: timeAgo(r.createdAt),
    status: r.status,
    staffReply: r.staffReply,
  };
}

function mapProductInquiry(r: ProductInquiryRow): ProductInquiry {
  return {
    id: r.id,
    name: r.clientName,
    initials: initials(r.clientName),
    email: r.email,
    phone: r.phone,
    product: r.productTitle,
    category: mapProductCategory(r.productCategory),
    message: r.message,
    customizations: r.customizations,
    receivedAt: timeAgo(r.createdAt),
    status: r.status,
    quantity: r.quantity,
    quotedInCents: r.quotedInCents,
  };
}

function mapProductCategory(cat: string): ServiceCategory | null {
  const lower = cat.toLowerCase();
  if (lower.includes("lash")) return "lash";
  if (lower.includes("jewel")) return "jewelry";
  if (lower.includes("crochet")) return "crochet";
  if (lower.includes("consult") || lower.includes("train")) return "consulting";
  return null;
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function InquiriesPage({
  initialInquiries,
  initialProductInquiries,
}: {
  initialInquiries: InquiryRow[];
  initialProductInquiries: ProductInquiryRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"general" | "products">("general");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedGeneral, setSelectedGeneral] = useState<GeneralInquiry | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductInquiry | null>(null);

  const generalList = initialInquiries.map(mapInquiry);
  const productList = initialProductInquiries.map(mapProductInquiry);

  const generalFilters = ["All", "New", "Read", "Replied", "Archived"];
  const productFilters = ["All", "New", "Contacted", "Quoted", "In Progress", "Completed"];
  const activeFilters = tab === "general" ? generalFilters : productFilters;

  const newCount = generalList.filter((i) => i.status === "new").length;
  const awaitingReply = generalList.filter((i) => i.status === "new" || i.status === "read").length;
  const pendingProductCount = productList.filter(
    (i) => i.status === "new" || i.status === "contacted",
  ).length;
  const completedCount = productList.filter((i) => i.status === "completed").length;

  const filteredGeneral = generalList.filter((i) => {
    const matchSearch =
      !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.message.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || statusBadge(i.status).label === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredProducts = productList.filter((i) => {
    const matchSearch =
      !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.product.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "All" || productStatusBadge(i.status).label === statusFilter;
    return matchSearch && matchStatus;
  });

  async function handleMarkRead(id: number) {
    await updateInquiryStatus(id, "read");
    router.refresh();
  }
  async function handleArchive(id: number) {
    await updateInquiryStatus(id, "archived");
    router.refresh();
  }
  async function handleReply(id: number, text: string) {
    await replyToInquiry(id, text);
    router.refresh();
  }
  async function handleSendQuote(id: number, amountInCents: number) {
    await sendProductQuote(id, amountInCents);
    router.refresh();
  }
  async function handleUpdateProductStatus(id: number, status: ProductInquiry["status"]) {
    await updateProductInquiryStatus(id, status);
    router.refresh();
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
            <p className="text-[10px] font-medium text-muted uppercase tracking-wide">Completed</p>
            <p className="text-2xl font-semibold text-foreground mt-1 tabular-nums">
              {completedCount}
            </p>
            <p className="text-xs text-[#4e6b51] mt-1">Orders fulfilled</p>
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
              const cat = inquiry.interest ? CATEGORY_COLOR[inquiry.interest] : null;
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
                  {isNew && (
                    <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[#c4907a]" />
                  )}

                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                      inquiry.interest
                        ? AVATAR_COLOR[inquiry.interest]
                        : "bg-foreground/10 text-foreground",
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
                      {cat && inquiry.interest && (
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
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-muted">{inquiry.email}</span>
                      {inquiry.phone && (
                        <span className="text-[11px] text-muted hidden sm:inline">
                          {inquiry.phone}
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
            const cat = inquiry.category ? CATEGORY_COLOR[inquiry.category] : null;
            const isPending = inquiry.status === "new" || inquiry.status === "contacted";
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

                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                    inquiry.category
                      ? AVATAR_COLOR[inquiry.category]
                      : "bg-foreground/10 text-foreground",
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
                    {cat && inquiry.category && (
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
                    )}
                  </div>

                  <p className="text-xs font-medium text-foreground/80 mt-0.5">{inquiry.product}</p>

                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px] text-muted">{inquiry.email}</span>
                  </div>

                  {inquiry.message && (
                    <p
                      className={cn(
                        "text-xs mt-1.5 line-clamp-2 leading-relaxed",
                        isPending ? "text-foreground/80" : "text-muted/80",
                      )}
                    >
                      {inquiry.message}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-1.5">
                    <p className="text-[10px] text-muted/50 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {inquiry.receivedAt}
                    </p>
                    {inquiry.quotedInCents && (
                      <p className="text-[10px] text-[#4e6b51] font-medium">
                        Quoted ${(inquiry.quotedInCents / 100).toLocaleString()}
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
        onReply={handleReply}
      />
      <ProductDetailDialog
        inquiry={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onSendQuote={handleSendQuote}
        onUpdateStatus={handleUpdateProductStatus}
      />
    </div>
  );
}
