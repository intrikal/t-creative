"use client";

import { useState, useMemo } from "react";
import { Clock, DollarSign, ChevronRight, ChevronLeft, Users, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, Field, Textarea } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & data                                                        */
/* ------------------------------------------------------------------ */

type Category = "lash" | "jewelry" | "crochet" | "consulting" | "training";

interface Service {
  id: number;
  name: string;
  category: Category;
  description: string;
  durationMin: number;
  priceLabel: string;
  assistants: string[];
  depositPct?: number;
}

const SERVICES: Service[] = [
  // Lash
  {
    id: 1,
    name: "Classic Full Set",
    category: "lash",
    description: "Natural-looking lash extensions, one extension per natural lash.",
    durationMin: 90,
    priceLabel: "$120",
    assistants: ["Trini", "Aaliyah"],
  },
  {
    id: 2,
    name: "Classic Lash Fill",
    category: "lash",
    description: "Fill appointment for existing classic set. Must be within 3 weeks.",
    durationMin: 60,
    priceLabel: "$65",
    assistants: ["Trini", "Aaliyah"],
  },
  {
    id: 3,
    name: "Hybrid Full Set",
    category: "lash",
    description: "Mix of classic and volume for a textured, wispy look.",
    durationMin: 105,
    priceLabel: "$145",
    assistants: ["Trini", "Aaliyah"],
  },
  {
    id: 4,
    name: "Hybrid Fill",
    category: "lash",
    description: "Fill for an existing hybrid set. Must be within 3 weeks.",
    durationMin: 75,
    priceLabel: "$80",
    assistants: ["Trini", "Aaliyah"],
  },
  {
    id: 5,
    name: "Volume Full Set",
    category: "lash",
    description: "Handcrafted fans of 2–6 extensions per lash for a dramatic look.",
    durationMin: 120,
    priceLabel: "$165",
    assistants: ["Trini"],
    depositPct: 30,
  },
  {
    id: 6,
    name: "Volume Fill",
    category: "lash",
    description: "Fill for an existing volume set. Must be within 3 weeks.",
    durationMin: 90,
    priceLabel: "$95",
    assistants: ["Trini"],
  },
  {
    id: 7,
    name: "Lash Removal",
    category: "lash",
    description: "Safe, professional removal of lash extensions.",
    durationMin: 30,
    priceLabel: "$25",
    assistants: ["Trini", "Aaliyah"],
  },
  // Jewelry
  {
    id: 8,
    name: "Permanent Bracelet Weld",
    category: "jewelry",
    description: "Custom-fit bracelet welded directly on your wrist. Clasp-free.",
    durationMin: 30,
    priceLabel: "From $65",
    assistants: ["Jade"],
  },
  {
    id: 9,
    name: "Permanent Anklet Weld",
    category: "jewelry",
    description: "Custom-fit anklet welded on your ankle. Water-safe.",
    durationMin: 30,
    priceLabel: "From $65",
    assistants: ["Jade"],
  },
  {
    id: 10,
    name: "Permanent Necklace Weld",
    category: "jewelry",
    description: "Delicate permanent necklace welded to your desired length.",
    durationMin: 45,
    priceLabel: "From $85",
    assistants: ["Jade"],
  },
  {
    id: 11,
    name: "Chain Sizing & Repair",
    category: "jewelry",
    description: "Sizing adjustment or repair of existing permanent jewelry.",
    durationMin: 20,
    priceLabel: "$25",
    assistants: ["Jade"],
  },
  // Crochet
  {
    id: 12,
    name: "Crochet Braid Install",
    category: "crochet",
    description: "Full crochet braid install. Hair not included unless add-on selected.",
    durationMin: 180,
    priceLabel: "From $120",
    assistants: ["Maya"],
  },
  {
    id: 13,
    name: "Crochet Updo",
    category: "crochet",
    description: "Elegant crochet updo for special events. Consult required for bridal.",
    durationMin: 120,
    priceLabel: "From $95",
    assistants: ["Maya"],
  },
  {
    id: 14,
    name: "Takedown & Detangle",
    category: "crochet",
    description: "Professional removal of crochet or protective style with detangling.",
    durationMin: 60,
    priceLabel: "$45",
    assistants: ["Maya"],
  },
  // Consulting
  {
    id: 15,
    name: "Discovery Call",
    category: "consulting",
    description: "Free 30-minute intro call to discuss your business goals.",
    durationMin: 30,
    priceLabel: "Free",
    assistants: ["Trini"],
  },
  {
    id: 16,
    name: "HR Strategy Session",
    category: "consulting",
    description: "Deep-dive session on hiring, team structure, and HR documentation.",
    durationMin: 60,
    priceLabel: "$150",
    assistants: ["Trini"],
    depositPct: 50,
  },
  {
    id: 17,
    name: "Employee Handbook Build",
    category: "consulting",
    description: "Full custom employee handbook drafted for your beauty business.",
    durationMin: 0,
    priceLabel: "$350",
    assistants: ["Trini"],
    depositPct: 50,
  },
  // Training
  {
    id: 18,
    name: "Lash Certification Course",
    category: "training",
    description: "2-day comprehensive lash tech certification covering classic, hybrid & volume.",
    durationMin: 0,
    priceLabel: "$800",
    assistants: ["Trini"],
    depositPct: 50,
  },
  {
    id: 19,
    name: "Permanent Jewelry Course",
    category: "training",
    description: "1-day hands-on training: welding technique, safety, and business setup.",
    durationMin: 0,
    priceLabel: "$450",
    assistants: ["Jade", "Trini"],
    depositPct: 50,
  },
  {
    id: 20,
    name: "Beauty Business Workshop",
    category: "training",
    description: "Half-day workshop on pricing, client retention, and social media.",
    durationMin: 0,
    priceLabel: "$200",
    assistants: ["Trini"],
  },
];

const CAT_CONFIG: Record<
  Category,
  { label: string; dot: string; bg: string; text: string; border: string }
> = {
  lash: {
    label: "Lash",
    dot: "bg-[#c4907a]",
    bg: "bg-[#c4907a]/12",
    text: "text-[#96604a]",
    border: "border-[#c4907a]/20",
  },
  jewelry: {
    label: "Jewelry",
    dot: "bg-[#d4a574]",
    bg: "bg-[#d4a574]/12",
    text: "text-[#a07040]",
    border: "border-[#d4a574]/20",
  },
  crochet: {
    label: "Crochet",
    dot: "bg-[#7ba3a3]",
    bg: "bg-[#7ba3a3]/12",
    text: "text-[#4a7a7a]",
    border: "border-[#7ba3a3]/20",
  },
  consulting: {
    label: "Consulting",
    dot: "bg-[#5b8a8a]",
    bg: "bg-[#5b8a8a]/12",
    text: "text-[#3a6060]",
    border: "border-[#5b8a8a]/20",
  },
  training: {
    label: "Training",
    dot: "bg-[#4e6b51]",
    bg: "bg-[#4e6b51]/12",
    text: "text-[#3a5440]",
    border: "border-[#4e6b51]/20",
  },
};

function formatDuration(min: number) {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${min}m`;
}

/* ------------------------------------------------------------------ */
/*  Date / time helpers                                                 */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAY_NAMES_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TODAY_ISO = "2026-02-21";

function fmtISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = addDays(first, -first.getDay());
  const end = addDays(last, 6 - last.getDay());
  const days: Date[] = [];
  let cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return days;
}

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, "0")}${ap}`;
}

function fmtDateLabel(ds: string): string {
  const [y, m, d] = ds.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES_FULL[date.getDay()]}, ${MONTH_NAMES[m - 1].slice(0, 3)} ${d}`;
}

/* ------------------------------------------------------------------ */
/*  Mock availability                                                   */
/* ------------------------------------------------------------------ */

const BASE_SLOTS = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30"];

const WORK_DAYS: Record<string, number[]> = {
  Trini: [1, 3, 5, 6], // Mon, Wed, Fri, Sat
  Aaliyah: [2, 4, 6], // Tue, Thu, Sat
  Jade: [1, 3, 5, 6], // Mon, Wed, Fri, Sat
  Maya: [2, 4], // Tue, Thu
};

function getAvailableSlots(dateStr: string, assistant: string): string[] {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date(TODAY_ISO + "T00:00:00");
  if (date <= today) return [];

  const dow = date.getDay();
  const workdays = WORK_DAYS[assistant] ?? [1, 2, 3, 4, 5];
  if (!workdays.includes(dow)) return [];

  // Pseudo-random seed per date+assistant to simulate taken slots
  const seed = Array.from(dateStr + assistant).reduce((a, c) => a + c.charCodeAt(0), 0);
  return BASE_SLOTS.filter((_, i) => (seed * (i + 1)) % 7 > 1);
}

/* ------------------------------------------------------------------ */
/*  MiniCal — date picker with availability                            */
/* ------------------------------------------------------------------ */

function MiniCal({
  selected,
  onSelect,
  assistant,
}: {
  selected: string;
  onSelect: (d: string) => void;
  assistant: string;
}) {
  const todayDate = new Date(TODAY_ISO + "T00:00:00");
  const [cursor, setCursor] = useState(
    () => new Date(todayDate.getFullYear(), todayDate.getMonth(), 1),
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
          className="p-1.5 rounded-lg text-muted hover:bg-foreground/8 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-foreground">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
          className="p-1.5 rounded-lg text-muted hover:bg-foreground/8 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-muted/70 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {grid.map((day) => {
          const ds = fmtISO(day);
          const isCurrentMonth = day.getMonth() === month;
          const slots = isCurrentMonth ? getAvailableSlots(ds, assistant) : [];
          const isAvailable = slots.length > 0;
          const isSelected = ds === selected;

          return (
            <div key={ds} className="flex justify-center">
              <button
                disabled={!isAvailable}
                onClick={() => isAvailable && onSelect(ds)}
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-full text-xs font-medium transition-colors",
                  !isCurrentMonth && "invisible pointer-events-none",
                  isSelected && "bg-accent text-white",
                  !isSelected && isAvailable && "hover:bg-accent/15 text-foreground",
                  !isSelected &&
                    !isAvailable &&
                    isCurrentMonth &&
                    "text-muted/30 cursor-not-allowed",
                )}
              >
                {day.getDate()}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-center text-muted mt-3">Highlighted dates have availability</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  BookingDialog — multi-step                                          */
/* ------------------------------------------------------------------ */

type Step = "assistant" | "date" | "time" | "confirm";

function BookingDialog({
  service,
  onClose,
  onSubmit,
}: {
  service: Service;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const hasMultiple = service.assistants.length > 1;
  const steps: Step[] = hasMultiple
    ? ["assistant", "date", "time", "confirm"]
    : ["date", "time", "confirm"];

  const [stepIdx, setStepIdx] = useState(0);
  const [assistant, setAssistant] = useState(service.assistants[0]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

  const currentStep = steps[stepIdx];
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === steps.length - 1;
  const slots = date ? getAvailableSlots(date, assistant) : [];

  function pickAssistant(a: string) {
    setAssistant(a);
    setDate("");
    setTime("");
    setStepIdx((i) => i + 1);
  }

  function pickDate(d: string) {
    setDate(d);
    setTime("");
    setStepIdx((i) => i + 1);
  }

  function pickTime(t: string) {
    setTime(t);
    setStepIdx((i) => i + 1);
  }

  const stepDescriptions: Record<Step, string> = {
    assistant: "Who would you like?",
    date: "Select an available date",
    time: date ? fmtDateLabel(date) : "Select a time",
    confirm: "Review and confirm",
  };

  return (
    <Dialog
      open
      title={service.name}
      description={stepDescriptions[currentStep]}
      onClose={onClose}
      size="sm"
    >
      {/* Progress bar */}
      <div className="flex gap-1 mb-5">
        {steps.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-0.5 flex-1 rounded-full transition-colors duration-300",
              i <= stepIdx ? "bg-accent" : "bg-border",
            )}
          />
        ))}
      </div>

      {/* Step: choose assistant */}
      {currentStep === "assistant" && (
        <div className="space-y-2">
          {service.assistants.map((a) => (
            <button
              key={a}
              onClick={() => pickAssistant(a)}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border hover:border-accent/30 hover:bg-accent/[0.03] transition-all group"
            >
              <div className="w-9 h-9 rounded-full bg-foreground/8 flex items-center justify-center text-sm font-bold text-foreground shrink-0 group-hover:bg-accent/10 group-hover:text-accent transition-colors">
                {a[0]}
              </div>
              <span className="flex-1 text-left text-sm font-medium text-foreground">{a}</span>
              <ChevronRight className="w-4 h-4 text-muted group-hover:text-accent transition-colors" />
            </button>
          ))}
        </div>
      )}

      {/* Step: pick date */}
      {currentStep === "date" && (
        <MiniCal selected={date} onSelect={pickDate} assistant={assistant} />
      )}

      {/* Step: pick time */}
      {currentStep === "time" && (
        <div className="space-y-4">
          <p className="text-xs text-muted">with {assistant}</p>
          <div className="grid grid-cols-3 gap-2">
            {slots.map((slot) => (
              <button
                key={slot}
                onClick={() => pickTime(slot)}
                className="py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:border-accent/40 hover:bg-accent/[0.03] transition-colors"
              >
                {fmt12(slot)}
              </button>
            ))}
          </div>
          {slots.length === 0 && (
            <p className="text-sm text-muted text-center py-6">No available slots for this date.</p>
          )}
        </div>
      )}

      {/* Step: confirm */}
      {currentStep === "confirm" && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            {[
              { label: "Service", value: service.name },
              { label: "With", value: assistant },
              { label: "Date", value: fmtDateLabel(date) },
              { label: "Time", value: fmt12(time) },
              ...(service.durationMin
                ? [{ label: "Duration", value: formatDuration(service.durationMin)! }]
                : []),
              { label: "Price", value: service.priceLabel },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-muted">{label}</span>
                <span
                  className={cn(
                    "font-medium text-foreground",
                    label === "Price" && "font-semibold",
                  )}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          {service.depositPct && (
            <p className="text-xs text-[#7a5c10] bg-[#7a5c10]/8 border border-[#7a5c10]/20 rounded-lg px-3 py-2">
              A {service.depositPct}% deposit is required to confirm this booking.
            </p>
          )}

          <Field label="Notes (optional)">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any requests, allergies, or questions..."
              rows={2}
            />
          </Field>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 mt-5 border-t border-border">
        <button
          onClick={isFirst ? onClose : () => setStepIdx((i) => i - 1)}
          className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground rounded-lg hover:bg-foreground/5 transition-colors"
        >
          {isFirst ? "Cancel" : "← Back"}
        </button>
        {isLast && (
          <button
            onClick={() => {
              onSubmit();
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            Send Request
          </button>
        )}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function ClientBookPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | Category>("all");
  const [bookingTarget, setBookingTarget] = useState<Service | null>(null);
  const [confirmedIds, setConfirmedIds] = useState<number[]>([]);

  const filtered = SERVICES.filter((s) => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || s.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const grouped = (Object.keys(CAT_CONFIG) as Category[]).reduce<Record<Category, Service[]>>(
    (acc, cat) => {
      acc[cat] = filtered.filter((s) => s.category === cat);
      return acc;
    },
    {} as Record<Category, Service[]>,
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Book a Service</h1>
        <p className="text-sm text-muted mt-0.5">Browse services and check availability</p>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            type="text"
            placeholder="Search services…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground placeholder:text-muted"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(["all", "lash", "jewelry", "crochet", "consulting", "training"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setCategoryFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize",
                categoryFilter === f
                  ? "bg-foreground/8 text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {f === "all" ? "All" : CAT_CONFIG[f].label}
            </button>
          ))}
        </div>
      </div>

      {/* Service groups */}
      <div className="space-y-8">
        {(Object.keys(CAT_CONFIG) as Category[]).map((cat) => {
          const services = grouped[cat];
          if (!services.length) return null;
          const cfg = CAT_CONFIG[cat];
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <span className={cn("w-2 h-2 rounded-full", cfg.dot)} />
                <h2 className="text-sm font-semibold text-foreground">{cfg.label}</h2>
                <span className="text-xs text-muted">({services.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {services.map((svc) => {
                  const confirmed = confirmedIds.includes(svc.id);
                  return (
                    <Card key={svc.id} className="gap-0 flex flex-col h-full">
                      <CardContent className="px-5 pt-5 pb-4 flex flex-col h-full">
                        <div className="flex items-start gap-2 mb-2">
                          <span
                            className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", cfg.dot)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground leading-snug">
                              {svc.name}
                            </p>
                          </div>
                          <Badge
                            className={cn(
                              "border text-[10px] px-1.5 py-0.5 shrink-0",
                              cfg.bg,
                              cfg.text,
                              cfg.border,
                            )}
                          >
                            {cfg.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted leading-relaxed flex-1">
                          {svc.description}
                        </p>
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50 flex-wrap">
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
                            <DollarSign className="w-3 h-3 text-[#4e6b51]" />
                            {svc.priceLabel}
                          </span>
                          {formatDuration(svc.durationMin) && (
                            <span className="flex items-center gap-1 text-[11px] text-muted">
                              <Clock className="w-3 h-3" />
                              {formatDuration(svc.durationMin)}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[11px] text-muted ml-auto">
                            <Users className="w-3 h-3" />
                            {svc.assistants.join(", ")}
                          </span>
                        </div>
                        {svc.depositPct && (
                          <p className="text-[10px] text-[#7a5c10] mt-1.5">
                            {svc.depositPct}% deposit required
                          </p>
                        )}
                        <button
                          onClick={() => !confirmed && setBookingTarget(svc)}
                          className={cn(
                            "mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors",
                            confirmed
                              ? "bg-[#4e6b51]/10 text-[#4e6b51] cursor-default"
                              : "bg-accent text-white hover:bg-accent/90",
                          )}
                        >
                          {confirmed ? (
                            "Request sent!"
                          ) : (
                            <>
                              Check Availability <ChevronRight className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 border border-dashed border-border rounded-xl">
            <p className="text-sm text-muted">No services match your search.</p>
          </div>
        )}
      </div>

      {bookingTarget && (
        <BookingDialog
          key={bookingTarget.id}
          service={bookingTarget}
          onClose={() => setBookingTarget(null)}
          onSubmit={() => setConfirmedIds((prev) => [...prev, bookingTarget.id])}
        />
      )}
    </div>
  );
}
