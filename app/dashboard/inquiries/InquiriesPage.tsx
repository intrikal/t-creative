"use client";

/**
 * InquiriesPage — Contact form inquiries + product inquiries pipeline.
 *
 * Two tabs: General (from `inquiries` table) and Products (from
 * `productInquiries` table). All data is hardcoded for now.
 */

import { useState } from "react";
import { Search, MessageSquare, ShoppingBag, Clock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & mock data                                                  */
/* ------------------------------------------------------------------ */

type InquiryStatus = "new" | "read" | "replied" | "archived";
type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting";

interface GeneralInquiry {
  id: number;
  name: string;
  initials: string;
  email: string;
  phone?: string;
  interest: ServiceCategory;
  message: string;
  receivedAt: string;
  status: InquiryStatus;
}

const MOCK_GENERAL: GeneralInquiry[] = [
  {
    id: 1,
    name: "Jordan Lee",
    initials: "JL",
    email: "jordan@example.com",
    phone: "(404) 555-0301",
    interest: "lash",
    message:
      "Hi! I'm interested in a full set of volume lashes for my graduation next month. Do you have availability in late March?",
    receivedAt: "1 hour ago",
    status: "new",
  },
  {
    id: 2,
    name: "Camille Foster",
    initials: "CF",
    email: "camille@example.com",
    interest: "jewelry",
    message:
      "Do you do matching sets? I'd love permanent jewelry for me and my sister as a birthday gift.",
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
    message:
      "I'm launching a beauty brand and need help structuring HR processes for a small team of 5.",
    receivedAt: "Yesterday",
    status: "read",
  },
  {
    id: 4,
    name: "Simone Davis",
    initials: "SD",
    email: "simone@example.com",
    interest: "lash",
    message:
      "Can I get a classic lash fill? I'm currently going to another studio but want to switch.",
    receivedAt: "Yesterday",
    status: "replied",
  },
  {
    id: 5,
    name: "Brittany Hall",
    initials: "BH",
    email: "brittany@example.com",
    interest: "crochet",
    message: "How long does a crochet braid install take? And do you provide the hair?",
    receivedAt: "2 days ago",
    status: "replied",
  },
  {
    id: 6,
    name: "Layla Martin",
    initials: "LM",
    email: "layla@example.com",
    interest: "jewelry",
    message: "I'm looking for a permanent anklet. Do you carry rose gold options?",
    receivedAt: "3 days ago",
    status: "archived",
  },
  {
    id: 7,
    name: "Denise Carter",
    initials: "DC",
    email: "denise@example.com",
    interest: "consulting",
    message:
      "I need help building out an employee handbook for my growing salon. Can we schedule a discovery call?",
    receivedAt: "4 days ago",
    status: "read",
  },
  {
    id: 8,
    name: "Whitney Brooks",
    initials: "WB",
    email: "whitney@example.com",
    interest: "lash",
    message:
      "What's the difference between classic, hybrid, and volume lashes? I've never had them done before.",
    receivedAt: "5 days ago",
    status: "replied",
  },
];

type ProductInquiryStatus = "pending" | "quoted" | "accepted" | "declined" | "completed";

interface ProductInquiry {
  id: number;
  name: string;
  initials: string;
  email: string;
  product: string;
  category: ServiceCategory;
  message: string;
  receivedAt: string;
  status: ProductInquiryStatus;
  budget?: string;
}

const MOCK_PRODUCTS: ProductInquiry[] = [
  {
    id: 1,
    name: "Aisha Thomas",
    initials: "AT",
    email: "aisha@example.com",
    product: "Custom Crochet Set — 26 Passion Twists",
    category: "crochet",
    message: "I'd like a custom order in burgundy and auburn. How long is the wait time?",
    receivedAt: "2 hours ago",
    status: "pending",
    budget: "$120–150",
  },
  {
    id: 2,
    name: "Renee Jackson",
    initials: "RJ",
    email: "renee@example.com",
    product: "Permanent Jewelry Gift Box",
    category: "jewelry",
    message: "Looking to order 3 gift sets for bridesmaids. Can you do custom packaging?",
    receivedAt: "Yesterday",
    status: "quoted",
    budget: "$250+",
  },
  {
    id: 3,
    name: "Monique Green",
    initials: "MG",
    email: "monique@example.com",
    product: "Custom Crochet Updo",
    category: "crochet",
    message: "I need a crochet updo for a wedding in April. What styles do you recommend?",
    receivedAt: "2 days ago",
    status: "accepted",
  },
  {
    id: 4,
    name: "Tamara Price",
    initials: "TP",
    email: "tamara@example.com",
    product: "Lash Extension Aftercare Kit",
    category: "lash",
    message: "Can I order 10 kits in bulk for a beauty school gift bag?",
    receivedAt: "3 days ago",
    status: "completed",
  },
  {
    id: 5,
    name: "Felicia Young",
    initials: "FY",
    email: "felicia@example.com",
    product: "Custom Training Materials",
    category: "consulting",
    message: "Do you sell your training curriculum for lash technicians separately?",
    receivedAt: "4 days ago",
    status: "declined",
  },
];

/* ------------------------------------------------------------------ */
/*  Display helpers                                                    */
/* ------------------------------------------------------------------ */

function inquiryStatusConfig(status: InquiryStatus) {
  switch (status) {
    case "new":
      return { label: "New", className: "bg-blush/12 text-[#96604a] border-blush/20" };
    case "read":
      return { label: "Read", className: "bg-foreground/8 text-muted border-foreground/10" };
    case "replied":
      return { label: "Replied", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "archived":
      return { label: "Archived", className: "bg-foreground/5 text-muted/60 border-foreground/8" };
  }
}

function productInquiryStatusConfig(status: ProductInquiryStatus) {
  switch (status) {
    case "pending":
      return { label: "Pending", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
    case "quoted":
      return { label: "Quoted", className: "bg-foreground/8 text-foreground border-foreground/15" };
    case "accepted":
      return { label: "Accepted", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "declined":
      return {
        label: "Declined",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      };
    case "completed":
      return {
        label: "Completed",
        className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20",
      };
  }
}

function categoryLabel(category: ServiceCategory) {
  return { lash: "Lash", jewelry: "Jewelry", crochet: "Crochet", consulting: "Consulting" }[
    category
  ];
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function InquiriesPage() {
  const [tab, setTab] = useState<"general" | "products">("general");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const generalFilters = ["All", "New", "Read", "Replied", "Archived"];
  const productFilters = ["All", "Pending", "Quoted", "Accepted", "Completed", "Declined"];
  const activeFilters = tab === "general" ? generalFilters : productFilters;

  const filteredGeneral = MOCK_GENERAL.filter((i) => {
    const matchSearch =
      !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.message.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "All" || inquiryStatusConfig(i.status).label === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredProducts = MOCK_PRODUCTS.filter((i) => {
    const matchSearch =
      !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.product.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "All" || productInquiryStatusConfig(i.status).label === statusFilter;
    return matchSearch && matchStatus;
  });

  const newCount = MOCK_GENERAL.filter((i) => i.status === "new").length;
  const pendingProductCount = MOCK_PRODUCTS.filter((i) => i.status === "pending").length;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Inquiries</h1>
        <p className="text-sm text-muted mt-0.5">
          {newCount} new contact · {pendingProductCount} pending product requests
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => {
            setTab("general");
            setStatusFilter("All");
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

      {/* Filters */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-4 px-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                type="text"
                placeholder={
                  tab === "general" ? "Search name or message…" : "Search name or product…"
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground placeholder:text-muted"
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
                      : "bg-surface text-muted hover:bg-foreground/8 hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-4 pt-3">
          {tab === "general" ? (
            filteredGeneral.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">No inquiries found.</p>
            ) : (
              filteredGeneral.map((inquiry) => {
                const status = inquiryStatusConfig(inquiry.status);
                return (
                  <div
                    key={inquiry.id}
                    className="flex gap-3 py-3 border-b border-border/50 last:border-0"
                  >
                    <Avatar size="sm">
                      <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                        {inquiry.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{inquiry.name}</span>
                        <Badge className={cn("border text-[10px] px-1.5 py-0.5", status.className)}>
                          {status.label}
                        </Badge>
                        <span className="text-[10px] text-muted border border-border/60 px-1.5 py-0.5 rounded-full">
                          {categoryLabel(inquiry.interest)}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-0.5">
                        {inquiry.email}
                        {inquiry.phone && ` · ${inquiry.phone}`}
                      </p>
                      <p className="text-xs text-muted/80 mt-1 line-clamp-2 leading-relaxed">
                        {inquiry.message}
                      </p>
                      <p className="text-[10px] text-muted/50 mt-1 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" /> {inquiry.receivedAt}
                      </p>
                    </div>
                  </div>
                );
              })
            )
          ) : filteredProducts.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No product inquiries found.</p>
          ) : (
            filteredProducts.map((inquiry) => {
              const status = productInquiryStatusConfig(inquiry.status);
              return (
                <div
                  key={inquiry.id}
                  className="flex gap-3 py-3 border-b border-border/50 last:border-0"
                >
                  <Avatar size="sm">
                    <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                      {inquiry.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{inquiry.name}</span>
                      <Badge className={cn("border text-[10px] px-1.5 py-0.5", status.className)}>
                        {status.label}
                      </Badge>
                      <span className="text-[10px] text-muted border border-border/60 px-1.5 py-0.5 rounded-full">
                        {categoryLabel(inquiry.category)}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-foreground/80 mt-0.5">
                      {inquiry.product}
                    </p>
                    <p className="text-xs text-muted mt-0.5 line-clamp-2 leading-relaxed">
                      {inquiry.message}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      {inquiry.budget && (
                        <span className="text-[10px] text-muted">Budget: {inquiry.budget}</span>
                      )}
                      <span className="text-[10px] text-muted/50 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" /> {inquiry.receivedAt}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
