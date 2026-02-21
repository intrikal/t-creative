"use client";

import { useState } from "react";
import {
  Search,
  Plus,
  Clock,
  DollarSign,
  Users,
  Pencil,
  Trash2,
  ToggleLeft,
  Package,
  FileText,
  Tag,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, Field, Input, Textarea, Select, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & mock data                                                  */
/* ------------------------------------------------------------------ */

type Category = "lash" | "jewelry" | "crochet" | "consulting" | "training";
type PriceType = "fixed" | "starting_at" | "range" | "free";

interface Service {
  id: number;
  name: string;
  category: Category;
  description: string;
  durationMin: number;
  priceType: PriceType;
  price: number;
  priceMax?: number;
  depositOverride?: number; // % — overrides global setting; undefined = use global
  staff: string[]; // staff who can perform this service
  active: boolean;
  bookings: number; // total bookings this period
}

const STAFF_ALL = ["Trini", "Aaliyah", "Jade", "Maya"];

const MOCK_SERVICES: Service[] = [
  // ── Lash ─────────────────────────────────────────────────────────
  {
    id: 1,
    name: "Classic Full Set",
    category: "lash",
    description: "Natural-looking lash extensions, one extension per natural lash.",
    durationMin: 90,
    priceType: "fixed",
    price: 120,
    staff: ["Trini", "Aaliyah"],
    active: true,
    bookings: 24,
  },
  {
    id: 2,
    name: "Classic Lash Fill",
    category: "lash",
    description: "Fill appointment for existing classic set. Must be within 3 weeks.",
    durationMin: 60,
    priceType: "fixed",
    price: 65,
    staff: ["Trini", "Aaliyah"],
    active: true,
    bookings: 38,
  },
  {
    id: 3,
    name: "Hybrid Full Set",
    category: "lash",
    description: "Mix of classic and volume techniques for a textured, wispy look.",
    durationMin: 105,
    priceType: "fixed",
    price: 145,
    staff: ["Trini", "Aaliyah"],
    active: true,
    bookings: 18,
  },
  {
    id: 4,
    name: "Hybrid Fill",
    category: "lash",
    description: "Fill for an existing hybrid set. Must be within 3 weeks.",
    durationMin: 75,
    priceType: "fixed",
    price: 80,
    staff: ["Trini", "Aaliyah"],
    active: true,
    bookings: 22,
  },
  {
    id: 5,
    name: "Volume Full Set",
    category: "lash",
    description: "Handcrafted fans of 2–6 extensions per natural lash for a dramatic look.",
    durationMin: 120,
    priceType: "fixed",
    price: 165,
    depositOverride: 30,
    staff: ["Trini"],
    active: true,
    bookings: 28,
  },
  {
    id: 6,
    name: "Volume Fill",
    category: "lash",
    description: "Fill for an existing volume set. Must be within 3 weeks.",
    durationMin: 90,
    priceType: "fixed",
    price: 95,
    staff: ["Trini"],
    active: true,
    bookings: 31,
  },
  {
    id: 7,
    name: "Mega Volume Set",
    category: "lash",
    description: "Ultra-dramatic look using 8–16 ultra-fine extensions per natural lash.",
    durationMin: 150,
    priceType: "fixed",
    price: 220,
    depositOverride: 50,
    staff: ["Trini"],
    active: true,
    bookings: 9,
  },
  {
    id: 8,
    name: "Mega Volume Fill",
    category: "lash",
    description: "Fill for an existing mega volume set. Must be within 2 weeks.",
    durationMin: 105,
    priceType: "fixed",
    price: 120,
    staff: ["Trini"],
    active: true,
    bookings: 11,
  },
  {
    id: 9,
    name: "Lash Removal",
    category: "lash",
    description: "Safe, professional removal of lash extensions.",
    durationMin: 30,
    priceType: "fixed",
    price: 25,
    staff: ["Trini", "Aaliyah"],
    active: true,
    bookings: 6,
  },
  // ── Jewelry ──────────────────────────────────────────────────────
  {
    id: 10,
    name: "Permanent Bracelet Weld",
    category: "jewelry",
    description: "Custom-fit permanent bracelet welded directly on your wrist. Clasp-free.",
    durationMin: 30,
    priceType: "starting_at",
    price: 65,
    staff: ["Jade"],
    active: true,
    bookings: 18,
  },
  {
    id: 11,
    name: "Permanent Anklet Weld",
    category: "jewelry",
    description: "Custom-fit permanent anklet welded on your ankle. Water-safe.",
    durationMin: 30,
    priceType: "starting_at",
    price: 65,
    staff: ["Jade"],
    active: true,
    bookings: 12,
  },
  {
    id: 12,
    name: "Permanent Necklace Weld",
    category: "jewelry",
    description: "Delicate permanent necklace welded to your desired length.",
    durationMin: 45,
    priceType: "starting_at",
    price: 85,
    staff: ["Jade"],
    active: true,
    bookings: 7,
  },
  {
    id: 13,
    name: "Chain Sizing & Repair",
    category: "jewelry",
    description: "Sizing adjustment or repair of existing permanent jewelry.",
    durationMin: 20,
    priceType: "fixed",
    price: 25,
    staff: ["Jade"],
    active: true,
    bookings: 4,
  },
  // ── Crochet ──────────────────────────────────────────────────────
  {
    id: 14,
    name: "Crochet Braid Install",
    category: "crochet",
    description: "Full crochet braid install. Hair not included unless add-on selected.",
    durationMin: 180,
    priceType: "starting_at",
    price: 120,
    staff: ["Maya"],
    active: true,
    bookings: 8,
  },
  {
    id: 15,
    name: "Crochet Updo",
    category: "crochet",
    description: "Elegant crochet updo for special events. Consult required for bridal.",
    durationMin: 120,
    priceType: "starting_at",
    price: 95,
    staff: ["Maya"],
    active: true,
    bookings: 5,
  },
  {
    id: 16,
    name: "Takedown & Detangle",
    category: "crochet",
    description: "Professional removal of crochet or protective style with detangling.",
    durationMin: 60,
    priceType: "fixed",
    price: 45,
    staff: ["Maya"],
    active: true,
    bookings: 3,
  },
  // ── Consulting ───────────────────────────────────────────────────
  {
    id: 17,
    name: "Discovery Call",
    category: "consulting",
    description: "Free 30-minute intro call to discuss your business goals and how Trini can help.",
    durationMin: 30,
    priceType: "free",
    price: 0,
    staff: ["Trini"],
    active: true,
    bookings: 12,
  },
  {
    id: 18,
    name: "HR Strategy Session",
    category: "consulting",
    description: "Deep-dive session on hiring, team structure, and HR documentation.",
    durationMin: 60,
    priceType: "fixed",
    price: 150,
    depositOverride: 50,
    staff: ["Trini"],
    active: true,
    bookings: 8,
  },
  {
    id: 19,
    name: "Employee Handbook Build",
    category: "consulting",
    description: "Full custom employee handbook drafted for your beauty business.",
    durationMin: 0,
    priceType: "fixed",
    price: 350,
    depositOverride: 50,
    staff: ["Trini"],
    active: true,
    bookings: 4,
  },
  {
    id: 20,
    name: "Business Launch Package",
    category: "consulting",
    description: "End-to-end support launching your beauty brand: branding, HR, pricing strategy.",
    durationMin: 0,
    priceType: "starting_at",
    price: 500,
    depositOverride: 30,
    staff: ["Trini"],
    active: true,
    bookings: 3,
  },
  // ── Training ─────────────────────────────────────────────────────
  {
    id: 21,
    name: "Lash Certification Course",
    category: "training",
    description:
      "Comprehensive 2-day lash technician certification covering classic, hybrid & volume.",
    durationMin: 0,
    priceType: "fixed",
    price: 800,
    depositOverride: 50,
    staff: ["Trini"],
    active: true,
    bookings: 6,
  },
  {
    id: 22,
    name: "Permanent Jewelry Course",
    category: "training",
    description: "1-day hands-on training: welding technique, safety, and business setup.",
    durationMin: 0,
    priceType: "fixed",
    price: 450,
    depositOverride: 50,
    staff: ["Jade", "Trini"],
    active: true,
    bookings: 4,
  },
  {
    id: 23,
    name: "Beauty Business Workshop",
    category: "training",
    description: "Half-day workshop on pricing, client retention, and social media marketing.",
    durationMin: 0,
    priceType: "fixed",
    price: 200,
    staff: ["Trini"],
    active: false,
    bookings: 2,
  },
];

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const CAT_CONFIG: Record<
  Category,
  { label: string; bg: string; text: string; dot: string; border: string }
> = {
  lash: {
    label: "Lash",
    bg: "bg-[#c4907a]/12",
    text: "text-[#96604a]",
    dot: "bg-[#c4907a]",
    border: "border-[#c4907a]/20",
  },
  jewelry: {
    label: "Jewelry",
    bg: "bg-[#d4a574]/12",
    text: "text-[#a07040]",
    dot: "bg-[#d4a574]",
    border: "border-[#d4a574]/20",
  },
  crochet: {
    label: "Crochet",
    bg: "bg-[#7ba3a3]/12",
    text: "text-[#4d8080]",
    dot: "bg-[#7ba3a3]",
    border: "border-[#7ba3a3]/20",
  },
  consulting: {
    label: "Consulting",
    bg: "bg-[#5b8a8a]/12",
    text: "text-[#3d6464]",
    dot: "bg-[#5b8a8a]",
    border: "border-[#5b8a8a]/20",
  },
  training: {
    label: "Training",
    bg: "bg-[#4e6b51]/12",
    text: "text-[#3a5440]",
    dot: "bg-[#4e6b51]",
    border: "border-[#4e6b51]/20",
  },
};

const STAFF_AVATAR: Record<string, string> = {
  Trini: "bg-[#c4907a] text-white",
  Aaliyah: "bg-[#7ba3a3] text-white",
  Jade: "bg-[#d4a574] text-white",
  Maya: "bg-[#5b8a8a] text-white",
};

function formatPrice(s: Service): string {
  if (s.priceType === "free") return "Free";
  if (s.priceType === "starting_at") return `From $${s.price}`;
  if (s.priceType === "range" && s.priceMax) return `$${s.price}–$${s.priceMax}`;
  return `$${s.price}`;
}

function formatDuration(min: number): string {
  if (!min) return "—";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/* ------------------------------------------------------------------ */
/*  Toggle                                                             */
/* ------------------------------------------------------------------ */

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
      className={cn(
        "relative w-9 h-5 rounded-full overflow-hidden transition-colors shrink-0 focus:outline-none",
        on ? "bg-accent" : "bg-foreground/20",
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200",
          on ? "translate-x-[19px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Service Form Dialog                                                */
/* ------------------------------------------------------------------ */

type ServiceFormData = Omit<Service, "id" | "bookings">;
const BLANK: ServiceFormData = {
  name: "",
  category: "lash",
  description: "",
  durationMin: 60,
  priceType: "fixed",
  price: 0,
  staff: ["Trini"],
  active: true,
};

function ServiceFormDialog({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: ServiceFormData | null;
  onSave: (data: ServiceFormData) => void;
}) {
  const [form, setForm] = useState<ServiceFormData>(initial ?? BLANK);

  // Reset form when dialog opens
  if (!open) return null;

  function set<K extends keyof ServiceFormData>(key: K, val: ServiceFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function toggleStaff(name: string) {
    setForm((prev) => ({
      ...prev,
      staff: prev.staff.includes(name)
        ? prev.staff.filter((s) => s !== name)
        : [...prev.staff, name],
    }));
  }

  const isEdit = !!initial;
  const canSave = form.name.trim().length > 0 && form.staff.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Service" : "Add Service"}
      description={isEdit ? "Update service details." : "Add a new service to your menu."}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Service Name" required>
            <Input
              placeholder="e.g. Classic Full Set"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label="Category" required>
            <Select
              value={form.category}
              onChange={(e) => set("category", e.target.value as Category)}
            >
              {(Object.keys(CAT_CONFIG) as Category[]).map((c) => (
                <option key={c} value={c}>
                  {CAT_CONFIG[c].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Description">
          <Textarea
            rows={2}
            placeholder="Brief description shown to clients…"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Duration (minutes)" hint="0 = project-based (no fixed time)">
            <Input
              type="number"
              min={0}
              step={15}
              value={form.durationMin}
              onChange={(e) => set("durationMin", Number(e.target.value))}
            />
          </Field>
          <Field label="Pricing Type" required>
            <Select
              value={form.priceType}
              onChange={(e) => set("priceType", e.target.value as PriceType)}
            >
              <option value="fixed">Fixed Price</option>
              <option value="starting_at">Starting At</option>
              <option value="range">Price Range</option>
              <option value="free">Free</option>
            </Select>
          </Field>
          {form.priceType !== "free" ? (
            <Field label={form.priceType === "range" ? "Min Price ($)" : "Price ($)"} required>
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => set("price", Number(e.target.value))}
              />
            </Field>
          ) : (
            <div />
          )}
        </div>

        {form.priceType === "range" && (
          <Field label="Max Price ($)" required>
            <Input
              type="number"
              min={form.price}
              value={form.priceMax ?? 0}
              onChange={(e) => set("priceMax", Number(e.target.value))}
            />
          </Field>
        )}

        <Field
          label="Deposit Override (%)"
          hint="Leave blank to use your global deposit setting (25%)"
        >
          <Input
            type="number"
            min={0}
            max={100}
            placeholder="e.g. 50"
            value={form.depositOverride ?? ""}
            onChange={(e) =>
              set("depositOverride", e.target.value === "" ? undefined : Number(e.target.value))
            }
          />
        </Field>

        {/* Staff assignment */}
        <Field label="Assign to Staff" required hint="Who can perform this service?">
          <div className="flex flex-wrap gap-2 mt-1">
            {STAFF_ALL.map((name) => {
              const selected = form.staff.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleStaff(name)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all",
                    selected
                      ? "bg-foreground text-background border-foreground"
                      : "bg-surface border-border text-muted hover:text-foreground hover:border-foreground/30",
                  )}
                >
                  <span
                    className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0",
                      STAFF_AVATAR[name],
                    )}
                  >
                    {name[0]}
                  </span>
                  {name}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Active toggle */}
        <div className="flex items-center justify-between py-1 border-t border-border/50">
          <div>
            <p className="text-sm font-medium text-foreground">Active</p>
            <p className="text-xs text-muted mt-0.5">
              Inactive services won&apos;t appear on your booking page
            </p>
          </div>
          <Toggle on={form.active} onChange={(v) => set("active", v)} />
        </div>
      </div>

      <DialogFooter
        onCancel={onClose}
        onConfirm={() => {
          if (canSave) {
            onSave(form);
            onClose();
          }
        }}
        confirmLabel={isEdit ? "Save Changes" : "Add Service"}
        disabled={!canSave}
      />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Service Card                                                       */
/* ------------------------------------------------------------------ */

function ServiceCard({
  service,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  service: Service;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const cat = CAT_CONFIG[service.category];

  return (
    <div
      className={cn(
        "group relative bg-background border rounded-2xl p-4 flex flex-col gap-3 transition-all hover:shadow-sm",
        service.active ? "border-border" : "border-border/40 opacity-60",
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className={cn("w-2 h-2 rounded-full shrink-0 mt-0.5", cat.dot)} />
          <h3
            className={cn(
              "text-sm font-semibold text-foreground leading-tight",
              !service.active && "text-muted",
            )}
          >
            {service.name}
          </h3>
        </div>
        {/* Hover actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/8 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-muted hover:text-destructive hover:bg-destructive/8 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Description */}
      {service.description && (
        <p className="text-xs text-muted leading-relaxed line-clamp-2">{service.description}</p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1 text-[11px] text-foreground font-medium">
          <DollarSign className="w-3 h-3 text-[#4e6b51]" />
          {formatPrice(service)}
        </span>
        {service.durationMin > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-muted">
            <Clock className="w-3 h-3" />
            {formatDuration(service.durationMin)}
          </span>
        )}
        {service.depositOverride !== undefined && (
          <span className="text-[10px] text-[#d4a574] bg-[#d4a574]/10 px-1.5 py-0.5 rounded-full border border-[#d4a574]/20">
            {service.depositOverride}% deposit
          </span>
        )}
      </div>

      {/* Staff avatars + active toggle */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 text-muted mr-0.5" />
          {service.staff.map((name) => (
            <span
              key={name}
              title={name}
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold -ml-0.5 ring-1 ring-background",
                STAFF_AVATAR[name],
              )}
            >
              {name[0]}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted tabular-nums">{service.bookings} booked</span>
          <Toggle on={service.active} onChange={onToggleActive} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bundles                                                            */
/* ------------------------------------------------------------------ */

interface Bundle {
  id: number;
  name: string;
  description: string;
  services: string[]; // service names
  originalPrice: number;
  bundlePrice: number;
  active: boolean;
  bookings: number;
}

const MOCK_BUNDLES: Bundle[] = [
  {
    id: 1,
    name: "New Client Lash Package",
    description: "Perfect intro bundle — full set + first fill at a discounted rate.",
    services: ["Classic Full Set", "Classic Lash Fill"],
    originalPrice: 185,
    bundlePrice: 160,
    active: true,
    bookings: 14,
  },
  {
    id: 2,
    name: "Volume Starter Pack",
    description: "Get a volume set and your first fill for less.",
    services: ["Volume Full Set", "Volume Fill"],
    originalPrice: 260,
    bundlePrice: 230,
    active: true,
    bookings: 9,
  },
  {
    id: 3,
    name: "Jewelry Duo",
    description: "Bracelet + anklet weld combo — popular for matching sets.",
    services: ["Permanent Bracelet Weld", "Permanent Anklet Weld"],
    originalPrice: 130,
    bundlePrice: 110,
    active: true,
    bookings: 7,
  },
  {
    id: 4,
    name: "Lash Biz Launch Bundle",
    description: "Lash certification course + business launch consulting package.",
    services: ["Lash Certification Course", "Business Launch Package"],
    originalPrice: 1300,
    bundlePrice: 1100,
    active: true,
    bookings: 2,
  },
  {
    id: 5,
    name: "VIP Lash Maintenance",
    description: "Hybrid set + 2 fills — great for quarterly lash maintenance clients.",
    services: ["Hybrid Full Set", "Hybrid Fill", "Hybrid Fill"],
    originalPrice: 305,
    bundlePrice: 265,
    active: false,
    bookings: 4,
  },
];

const ALL_SERVICE_NAMES = MOCK_SERVICES.map((s) => s.name);

interface BundleForm {
  name: string;
  description: string;
  services: string[];
  originalPrice: number;
  bundlePrice: number;
  active: boolean;
}

const BLANK_BUNDLE: BundleForm = {
  name: "",
  description: "",
  services: [],
  originalPrice: 0,
  bundlePrice: 0,
  active: true,
};

function BundleFormDialog({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: BundleForm | null;
  onSave: (f: BundleForm) => void;
}) {
  const [form, setForm] = useState<BundleForm>(initial ?? BLANK_BUNDLE);
  if (!open) return null;

  function toggleService(name: string) {
    setForm((prev) => ({
      ...prev,
      services: prev.services.includes(name)
        ? prev.services.filter((s) => s !== name)
        : [...prev.services, name],
    }));
  }

  const canSave = form.name.trim() && form.services.length >= 2 && form.bundlePrice > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? "Edit Bundle" : "New Bundle"}
      description="Group services into a discounted package."
      size="lg"
    >
      <div className="space-y-4">
        <Field label="Bundle Name" required>
          <Input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. New Client Lash Package"
            autoFocus
          />
        </Field>
        <Field label="Description">
          <Textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Brief description for clients…"
          />
        </Field>
        <Field label="Included Services" required hint="Select at least 2 services">
          <div className="flex flex-wrap gap-1.5 mt-1 max-h-36 overflow-y-auto">
            {ALL_SERVICE_NAMES.map((name) => {
              const selected = form.services.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleService(name)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                    selected
                      ? "bg-foreground text-background border-foreground"
                      : "bg-surface border-border text-muted hover:border-foreground/30 hover:text-foreground",
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Original Price ($)" hint="Sum of individual services">
            <Input
              type="number"
              min={0}
              value={form.originalPrice}
              onChange={(e) => setForm((p) => ({ ...p, originalPrice: Number(e.target.value) }))}
            />
          </Field>
          <Field label="Bundle Price ($)" required>
            <Input
              type="number"
              min={0}
              value={form.bundlePrice}
              onChange={(e) => setForm((p) => ({ ...p, bundlePrice: Number(e.target.value) }))}
            />
          </Field>
        </div>
        {form.originalPrice > 0 &&
          form.bundlePrice > 0 &&
          form.bundlePrice < form.originalPrice && (
            <p className="text-xs text-[#4e6b51]">
              Clients save ${form.originalPrice - form.bundlePrice} (
              {Math.round(((form.originalPrice - form.bundlePrice) / form.originalPrice) * 100)}%
              off)
            </p>
          )}
        <div className="flex items-center justify-between py-1 border-t border-border/50">
          <div>
            <p className="text-sm font-medium text-foreground">Active</p>
            <p className="text-xs text-muted mt-0.5">
              Inactive bundles won&apos;t appear on your booking page
            </p>
          </div>
          <Toggle on={form.active} onChange={(v) => setForm((p) => ({ ...p, active: v }))} />
        </div>
      </div>
      <DialogFooter
        onCancel={onClose}
        onConfirm={() => {
          if (canSave) {
            onSave(form);
            onClose();
          }
        }}
        confirmLabel={initial ? "Save Changes" : "Create Bundle"}
        disabled={!canSave}
      />
    </Dialog>
  );
}

function BundlesTab() {
  const [bundles, setBundles] = useState<Bundle[]>(MOCK_BUNDLES);
  const [bundleFormOpen, setBundleFormOpen] = useState(false);
  const [editBundle, setEditBundle] = useState<Bundle | null>(null);

  function toggleActive(id: number) {
    setBundles((prev) => prev.map((b) => (b.id === id ? { ...b, active: !b.active } : b)));
  }

  function handleSave(form: BundleForm) {
    if (editBundle) {
      setBundles((prev) => prev.map((b) => (b.id === editBundle.id ? { ...b, ...form } : b)));
    } else {
      setBundles((prev) => [...prev, { ...form, id: Date.now(), bookings: 0 }]);
    }
    setEditBundle(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Service Bundles</h2>
          <p className="text-xs text-muted mt-0.5">
            Combine services into discounted packages to increase bookings.
          </p>
        </div>
        <button
          onClick={() => {
            setEditBundle(null);
            setBundleFormOpen(true);
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Bundle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {bundles.map((b) => {
          const savings = b.originalPrice - b.bundlePrice;
          const pct = Math.round((savings / b.originalPrice) * 100);
          return (
            <div
              key={b.id}
              className={cn(
                "group relative bg-background border rounded-2xl p-4 flex flex-col gap-3 transition-all hover:shadow-sm",
                b.active ? "border-border" : "border-border/40 opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                  <h3 className="text-sm font-semibold text-foreground leading-tight truncate">
                    {b.name}
                  </h3>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => {
                      setEditBundle(b);
                      setBundleFormOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/8 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setBundles((prev) => prev.filter((x) => x.id !== b.id))}
                    className="p-1.5 rounded-lg text-muted hover:text-destructive hover:bg-destructive/8 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-muted leading-relaxed line-clamp-2">{b.description}</p>

              <div className="flex flex-wrap gap-1">
                {b.services.map((svc, i) => (
                  <span
                    key={i}
                    className="text-[10px] bg-surface border border-border text-muted px-2 py-0.5 rounded-full"
                  >
                    {svc}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-foreground">${b.bundlePrice}</span>
                <span className="text-xs text-muted line-through">${b.originalPrice}</span>
                {pct > 0 && (
                  <span className="text-[10px] font-medium text-[#4e6b51] bg-[#4e6b51]/10 px-1.5 py-0.5 rounded-full">
                    Save {pct}%
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                <span className="text-[10px] text-muted tabular-nums">{b.bookings} purchased</span>
                <Toggle on={b.active} onChange={() => toggleActive(b.id)} />
              </div>
            </div>
          );
        })}
      </div>

      <BundleFormDialog
        open={bundleFormOpen}
        onClose={() => {
          setBundleFormOpen(false);
          setEditBundle(null);
        }}
        initial={
          editBundle
            ? {
                name: editBundle.name,
                description: editBundle.description,
                services: editBundle.services,
                originalPrice: editBundle.originalPrice,
                bundlePrice: editBundle.bundlePrice,
                active: editBundle.active,
              }
            : null
        }
        onSave={handleSave}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Forms / Waivers                                                    */
/* ------------------------------------------------------------------ */

type FormType = "intake" | "waiver" | "consent" | "custom";

interface ClientForm {
  id: number;
  name: string;
  type: FormType;
  description: string;
  appliesTo: string[]; // category labels or "All"
  required: boolean;
  lastUpdated: string;
  responses: number;
  active: boolean;
}

const FORM_TYPE_CONFIG: Record<FormType, { label: string; color: string; bg: string }> = {
  intake: { label: "Intake", color: "text-[#5b8a8a]", bg: "bg-[#5b8a8a]/10" },
  waiver: { label: "Waiver", color: "text-[#c4907a]", bg: "bg-[#c4907a]/10" },
  consent: { label: "Consent", color: "text-[#d4a574]", bg: "bg-[#d4a574]/10" },
  custom: { label: "Custom", color: "text-muted", bg: "bg-surface" },
};

const MOCK_FORMS: ClientForm[] = [
  {
    id: 1,
    name: "New Client Intake",
    type: "intake",
    description:
      "Collects contact info, health history, allergies, and lash/style preferences before first appointment.",
    appliesTo: ["All"],
    required: true,
    lastUpdated: "Jan 15, 2025",
    responses: 58,
    active: true,
  },
  {
    id: 2,
    name: "Lash Extension Consent",
    type: "consent",
    description:
      "Covers risks, aftercare expectations, and client acknowledgment for lash services.",
    appliesTo: ["Lash"],
    required: true,
    lastUpdated: "Dec 3, 2024",
    responses: 142,
    active: true,
  },
  {
    id: 3,
    name: "Permanent Jewelry Liability Waiver",
    type: "waiver",
    description:
      "Liability release for welding process, skin sensitivity, and permanent jewelry removal.",
    appliesTo: ["Jewelry"],
    required: true,
    lastUpdated: "Nov 20, 2024",
    responses: 41,
    active: true,
  },
  {
    id: 4,
    name: "Crochet Style Consult Form",
    type: "intake",
    description:
      "Hair type, style preferences, scalp sensitivity, and reference photos for crochet appointments.",
    appliesTo: ["Crochet"],
    required: false,
    lastUpdated: "Oct 8, 2024",
    responses: 16,
    active: true,
  },
  {
    id: 5,
    name: "Training Student Agreement",
    type: "waiver",
    description:
      "Covers course terms, refund policy, IP rights, and student acknowledgment of curriculum.",
    appliesTo: ["Training"],
    required: true,
    lastUpdated: "Sep 1, 2024",
    responses: 12,
    active: true,
  },
  {
    id: 6,
    name: "Consultation Follow-Up Questionnaire",
    type: "custom",
    description:
      "Post-session feedback form for consulting clients — goals, action items, and satisfaction rating.",
    appliesTo: ["Consulting"],
    required: false,
    lastUpdated: "Jan 2, 2025",
    responses: 9,
    active: false,
  },
];

/* ── Form field types ── */
type FieldType =
  | "text"
  | "textarea"
  | "select"
  | "checkbox"
  | "date"
  | "phone"
  | "email"
  | "signature";
interface FormField {
  id: number;
  label: string;
  type: FieldType;
  required: boolean;
}

const DEFAULT_FIELDS: Record<FormType, FormField[]> = {
  intake: [
    { id: 1, label: "Full Name", type: "text", required: true },
    { id: 2, label: "Email Address", type: "email", required: true },
    { id: 3, label: "Phone Number", type: "phone", required: true },
    { id: 4, label: "Date of Birth", type: "date", required: false },
    { id: 5, label: "Known Allergies", type: "textarea", required: false },
    { id: 6, label: "Style Preferences", type: "textarea", required: false },
  ],
  waiver: [
    { id: 1, label: "Full Name", type: "text", required: true },
    { id: 2, label: "Date", type: "date", required: true },
    { id: 3, label: "I agree to the terms", type: "checkbox", required: true },
    { id: 4, label: "Signature", type: "signature", required: true },
  ],
  consent: [
    { id: 1, label: "Full Name", type: "text", required: true },
    { id: 2, label: "Consent to service", type: "checkbox", required: true },
    { id: 3, label: "Medical conditions", type: "textarea", required: false },
    { id: 4, label: "Signature", type: "signature", required: true },
  ],
  custom: [
    { id: 1, label: "Full Name", type: "text", required: true },
    { id: 2, label: "Your Question", type: "textarea", required: false },
  ],
};

const MOCK_RESPONSES: Record<
  number,
  { id: number; client: string; date: string; status: "complete" | "partial" }[]
> = {
  1: [
    { id: 1, client: "Amara Johnson", date: "Feb 18, 2025", status: "complete" },
    { id: 2, client: "Destiny Cruz", date: "Jan 5, 2025", status: "complete" },
    { id: 3, client: "Maya Robinson", date: "Sep 22, 2024", status: "complete" },
    { id: 4, client: "Priya Kumar", date: "Aug 14, 2024", status: "partial" },
    { id: 5, client: "Chloe Thompson", date: "Jul 30, 2024", status: "complete" },
  ],
  2: [
    { id: 1, client: "Sarah Mitchell", date: "Oct 18, 2024", status: "complete" },
    { id: 2, client: "Maya Robinson", date: "Sep 22, 2024", status: "complete" },
    { id: 3, client: "Amara Johnson", date: "Feb 18, 2025", status: "complete" },
  ],
  3: [
    { id: 1, client: "Nina Patel", date: "Nov 3, 2024", status: "complete" },
    { id: 2, client: "Camille Foster", date: "Feb 14, 2025", status: "complete" },
  ],
  4: [
    { id: 1, client: "Keisha Williams", date: "Jan 20, 2025", status: "complete" },
    { id: 2, client: "Amy Lin", date: "May 20, 2024", status: "partial" },
  ],
  5: [{ id: 1, client: "Jordan Lee", date: "Apr 11, 2024", status: "complete" }],
  6: [
    { id: 1, client: "Marcus Banks", date: "Jun 8, 2024", status: "complete" },
    { id: 2, client: "Aaliyah Washington", date: "Mar 5, 2024", status: "partial" },
  ],
};

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Short text",
  textarea: "Long text",
  select: "Dropdown",
  checkbox: "Checkbox",
  date: "Date",
  phone: "Phone",
  email: "Email",
  signature: "Signature",
};

function ViewResponsesDialog({ form, onClose }: { form: ClientForm; onClose: () => void }) {
  const responses = MOCK_RESPONSES[form.id] ?? [];
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Responses — ${form.name}`}
      description={`${responses.length} submissions`}
      size="md"
    >
      {responses.length === 0 ? (
        <p className="text-sm text-muted text-center py-6">No responses yet.</p>
      ) : (
        <div className="space-y-1">
          {responses.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-surface/60 transition-colors border border-transparent hover:border-border/50"
            >
              <div className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center text-[10px] font-semibold text-muted shrink-0">
                {r.client
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{r.client}</p>
                <p className="text-xs text-muted mt-0.5">{r.date}</p>
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                  r.status === "complete"
                    ? "bg-[#4e6b51]/10 text-[#4e6b51] border-[#4e6b51]/20"
                    : "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20",
                )}
              >
                {r.status === "complete" ? "Complete" : "Partial"}
              </span>
            </div>
          ))}
        </div>
      )}
      <DialogFooter onCancel={onClose} onConfirm={onClose} confirmLabel="Close" />
    </Dialog>
  );
}

function EditFieldsDialog({ form, onClose }: { form: ClientForm; onClose: () => void }) {
  const [fields, setFields] = useState<FormField[]>(DEFAULT_FIELDS[form.type] ?? []);

  function toggleRequired(id: number) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, required: !f.required } : f)));
  }
  function removeField(id: number) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }
  function addField() {
    setFields((prev) => [
      ...prev,
      { id: Date.now(), label: "New Field", type: "text", required: false },
    ]);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Edit Fields — ${form.name}`}
      description="Configure the fields clients see when filling out this form."
      size="lg"
    >
      <div className="space-y-2">
        {fields.map((field, idx) => (
          <div
            key={field.id}
            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface/40 group"
          >
            <span className="text-[10px] text-muted/50 tabular-nums w-4 shrink-0">{idx + 1}</span>
            <input
              className="flex-1 text-sm text-foreground bg-transparent border-none outline-none min-w-0"
              value={field.label}
              onChange={(e) =>
                setFields((prev) =>
                  prev.map((f) => (f.id === field.id ? { ...f, label: e.target.value } : f)),
                )
              }
            />
            <select
              className="text-xs text-muted bg-background border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30 shrink-0"
              value={field.type}
              onChange={(e) =>
                setFields((prev) =>
                  prev.map((f) =>
                    f.id === field.id ? { ...f, type: e.target.value as FieldType } : f,
                  ),
                )
              }
            >
              {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
                <option key={t} value={t}>
                  {FIELD_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-muted shrink-0 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={field.required}
                onChange={() => toggleRequired(field.id)}
                className="accent-accent w-3.5 h-3.5"
              />
              Req
            </label>
            <button
              onClick={() => removeField(field.id)}
              className="p-1 rounded-lg text-muted hover:text-destructive hover:bg-destructive/8 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button
          onClick={addField}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border border-dashed border-border text-xs font-medium text-muted hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Field
        </button>
      </div>
      <DialogFooter onCancel={onClose} onConfirm={onClose} confirmLabel="Save Fields" />
    </Dialog>
  );
}

interface NewFormData {
  name: string;
  type: FormType;
  appliesTo: string[];
  description: string;
  required: boolean;
}

const APPLIES_TO_OPTIONS = ["All", "Lash", "Jewelry", "Crochet", "Consulting", "Training"];

function NewFormDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (f: NewFormData) => void;
}) {
  const [form, setForm] = useState<NewFormData>({
    name: "",
    type: "intake",
    appliesTo: ["All"],
    description: "",
    required: false,
  });
  if (!open) return null;

  function toggleAppliesTo(val: string) {
    setForm((prev) => {
      if (val === "All") return { ...prev, appliesTo: ["All"] };
      const without = prev.appliesTo.filter((a) => a !== "All" && a !== val);
      return { ...prev, appliesTo: prev.appliesTo.includes(val) ? without : [...without, val] };
    });
  }

  const canSave = form.name.trim() && form.appliesTo.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Form"
      description="Create a new intake form, waiver, or consent form."
      size="md"
    >
      <div className="space-y-4">
        <Field label="Form Name" required>
          <Input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. New Client Intake"
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Form Type" required>
            <Select
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as FormType }))}
            >
              <option value="intake">Intake</option>
              <option value="waiver">Waiver</option>
              <option value="consent">Consent</option>
              <option value="custom">Custom</option>
            </Select>
          </Field>
          <Field label="Applies To" required>
            <div className="flex flex-wrap gap-1 mt-1">
              {APPLIES_TO_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleAppliesTo(opt)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                    form.appliesTo.includes(opt)
                      ? "bg-foreground text-background border-foreground"
                      : "bg-surface border-border text-muted hover:text-foreground",
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="What does this form collect?"
          />
        </Field>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.required}
            onChange={(e) => setForm((p) => ({ ...p, required: e.target.checked }))}
            className="accent-accent w-4 h-4"
          />
          <span className="text-sm text-foreground">Required before appointment</span>
        </label>
      </div>
      <DialogFooter
        onCancel={onClose}
        onConfirm={() => {
          if (canSave) {
            onSave(form);
            onClose();
          }
        }}
        confirmLabel="Create Form"
        disabled={!canSave}
      />
    </Dialog>
  );
}

function FormsTab() {
  const [forms, setForms] = useState<ClientForm[]>(MOCK_FORMS);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newFormOpen, setNewFormOpen] = useState(false);
  const [viewResponsesTarget, setViewResponsesTarget] = useState<ClientForm | null>(null);
  const [editFieldsTarget, setEditFieldsTarget] = useState<ClientForm | null>(null);

  function toggleActive(id: number) {
    setForms((prev) => prev.map((f) => (f.id === id ? { ...f, active: !f.active } : f)));
  }

  function handleNewForm(data: NewFormData) {
    setForms((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: data.name,
        type: data.type,
        description: data.description,
        appliesTo: data.appliesTo,
        required: data.required,
        lastUpdated: "Today",
        responses: 0,
        active: true,
      },
    ]);
  }

  const active = forms.filter((f) => f.active).length;
  const totalResponses = forms.reduce((a, b) => a + b.responses, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Forms & Waivers</h2>
          <p className="text-xs text-muted mt-0.5">
            Intake forms, consent forms, and liability waivers sent before appointments.
          </p>
        </div>
        <button
          onClick={() => setNewFormOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Form
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-background border border-border rounded-xl p-3">
          <p className="text-[10px] text-muted uppercase tracking-wide font-medium">Total Forms</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{forms.length}</p>
        </div>
        <div className="bg-background border border-border rounded-xl p-3">
          <p className="text-[10px] text-muted uppercase tracking-wide font-medium">Active</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{active}</p>
        </div>
        <div className="bg-background border border-border rounded-xl p-3">
          <p className="text-[10px] text-muted uppercase tracking-wide font-medium">
            Total Responses
          </p>
          <p className="text-2xl font-semibold text-foreground mt-1">{totalResponses}</p>
        </div>
      </div>

      <div className="space-y-2">
        {forms.map((f) => {
          const cfg = FORM_TYPE_CONFIG[f.type];
          const expanded = expandedId === f.id;
          return (
            <div
              key={f.id}
              className={cn(
                "bg-background border rounded-xl overflow-hidden transition-all",
                f.active ? "border-border" : "border-border/40 opacity-60",
              )}
            >
              <div
                className="group flex items-center gap-3 p-4 cursor-pointer hover:bg-foreground/3 transition-colors"
                onClick={() => setExpandedId(expanded ? null : f.id)}
              >
                <FileText className="w-4 h-4 text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{f.name}</p>
                    <span
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                        cfg.color,
                        cfg.bg,
                      )}
                    >
                      {cfg.label}
                    </span>
                    {f.required && (
                      <span className="flex items-center gap-0.5 text-[10px] text-[#c4907a]">
                        <AlertCircle className="w-2.5 h-2.5" />
                        Required
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {f.appliesTo.map((a) => (
                      <span key={a} className="text-[10px] text-muted">
                        {a}
                      </span>
                    ))}
                    <span className="text-[10px] text-muted">·</span>
                    <span className="text-[10px] text-muted">{f.responses} responses</span>
                    <span className="text-[10px] text-muted">·</span>
                    <span className="text-[10px] text-muted">Updated {f.lastUpdated}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditFieldsTarget(f);
                      }}
                      className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/8 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Toggle on={f.active} onChange={() => toggleActive(f.id)} />
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 text-muted transition-transform",
                      expanded && "rotate-180",
                    )}
                  />
                </div>
              </div>

              {expanded && (
                <div className="px-4 pb-4 border-t border-border/50">
                  <p className="text-xs text-muted mt-3 leading-relaxed">{f.description}</p>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <button
                      onClick={() => setViewResponsesTarget(f)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-surface border border-border rounded-lg hover:bg-foreground/5 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#4e6b51]" />
                      View Responses
                    </button>
                    <button
                      onClick={() => setEditFieldsTarget(f)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-surface border border-border rounded-lg hover:bg-foreground/5 transition-colors"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      Edit Fields
                    </button>
                    <button
                      onClick={() => setForms((prev) => prev.filter((x) => x.id !== f.id))}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive bg-destructive/5 border border-destructive/20 rounded-lg hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <NewFormDialog
        open={newFormOpen}
        onClose={() => setNewFormOpen(false)}
        onSave={handleNewForm}
      />
      {viewResponsesTarget && (
        <ViewResponsesDialog
          form={viewResponsesTarget}
          onClose={() => setViewResponsesTarget(null)}
        />
      )}
      {editFieldsTarget && (
        <EditFieldsDialog form={editFieldsTarget} onClose={() => setEditFieldsTarget(null)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

const SERVICES_TABS = [
  { id: "menu", label: "Menu", icon: Tag },
  { id: "bundles", label: "Bundles", icon: Package },
  { id: "forms", label: "Forms & Waivers", icon: FileText },
] as const;
type ServicesTab = (typeof SERVICES_TABS)[number]["id"];

const CATEGORY_FILTERS = ["All", "Lash", "Jewelry", "Crochet", "Consulting", "Training"] as const;

export function ServicesPage() {
  const [activeTab, setActiveTab] = useState<ServicesTab>("menu");
  const [services, setServices] = useState<Service[]>(MOCK_SERVICES);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Service | null>(null);

  const filtered = services.filter((s) => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "All" || CAT_CONFIG[s.category].label === categoryFilter;
    const matchStatus =
      statusFilter === "all" || (statusFilter === "active" ? s.active : !s.active);
    return matchSearch && matchCat && matchStatus;
  });

  function handleSave(data: ServiceFormData) {
    if (editTarget) {
      setServices((prev) => prev.map((s) => (s.id === editTarget.id ? { ...s, ...data } : s)));
    } else {
      const newId = Math.max(...services.map((s) => s.id)) + 1;
      setServices((prev) => [...prev, { ...data, id: newId, bookings: 0 }]);
    }
    setEditTarget(null);
  }

  function handleDelete(id: number) {
    setServices((prev) => prev.filter((s) => s.id !== id));
  }

  function handleToggleActive(id: number) {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
  }

  const activeCount = services.filter((s) => s.active).length;
  const avgPrice = Math.round(
    services.filter((s) => s.priceType === "fixed").reduce((a, b) => a + b.price, 0) /
      services.filter((s) => s.priceType === "fixed").length,
  );
  const topService = [...services].sort((a, b) => b.bookings - a.bookings)[0];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Services</h1>
          <p className="text-sm text-muted mt-0.5">
            Your full service menu — pricing, duration, and staff assignments
          </p>
        </div>
        {activeTab === "menu" && (
          <button
            onClick={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-xl hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Service
          </button>
        )}
      </div>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border -mt-2">
        {SERVICES_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground hover:border-border",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>
      {/* Tab panels */}
      {activeTab === "bundles" && <BundlesTab />}
      {activeTab === "forms" && <FormsTab />}
      {activeTab === "menu" && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="gap-0 py-4">
              <CardContent className="px-4">
                <p className="text-[10px] font-medium text-muted uppercase tracking-wide">
                  Total Services
                </p>
                <p className="text-2xl font-semibold text-foreground mt-1">{services.length}</p>
                <p className="text-xs text-muted mt-1">across 5 categories</p>
              </CardContent>
            </Card>
            <Card className="gap-0 py-4">
              <CardContent className="px-4">
                <p className="text-[10px] font-medium text-muted uppercase tracking-wide">Active</p>
                <p className="text-2xl font-semibold text-foreground mt-1">{activeCount}</p>
                <p className="text-xs text-muted mt-1">{services.length - activeCount} inactive</p>
              </CardContent>
            </Card>
            <Card className="gap-0 py-4">
              <CardContent className="px-4">
                <p className="text-[10px] font-medium text-muted uppercase tracking-wide">
                  Avg Price
                </p>
                <p className="text-2xl font-semibold text-foreground mt-1">${avgPrice}</p>
                <p className="text-xs text-muted mt-1">fixed-price services</p>
              </CardContent>
            </Card>
            <Card className="gap-0 py-4">
              <CardContent className="px-4">
                <p className="text-[10px] font-medium text-muted uppercase tracking-wide">
                  Most Booked
                </p>
                <p className="text-base font-semibold text-foreground mt-1 truncate">
                  {topService.name}
                </p>
                <p className="text-xs text-[#4e6b51] mt-1">{topService.bookings} bookings</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
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
            <div className="flex items-center gap-1 flex-wrap">
              {CATEGORY_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setCategoryFilter(f)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    categoryFilter === f
                      ? "bg-foreground text-background"
                      : "bg-surface border border-border text-muted hover:text-foreground hover:bg-foreground/5",
                  )}
                >
                  {f}
                </button>
              ))}
              <div className="w-px h-5 bg-border mx-1" />
              {(["all", "active", "inactive"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize",
                    statusFilter === s
                      ? "bg-foreground text-background"
                      : "bg-surface border border-border text-muted hover:text-foreground hover:bg-foreground/5",
                  )}
                >
                  {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
              <button
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("All");
                  setStatusFilter("all");
                }}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
              >
                <ToggleLeft className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>

          {/* Category sections */}
          {categoryFilter === "All" ? (
            <div className="space-y-8">
              {(Object.keys(CAT_CONFIG) as Category[]).map((cat) => {
                const catServices = filtered.filter((s) => s.category === cat);
                if (catServices.length === 0) return null;
                const cfg = CAT_CONFIG[cat];
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={cn("w-2 h-2 rounded-full", cfg.dot)} />
                      <h2 className="text-sm font-semibold text-foreground">{cfg.label}</h2>
                      <span className="text-xs text-muted">({catServices.length})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {catServices.map((s) => (
                        <ServiceCard
                          key={s.id}
                          service={s}
                          onEdit={() => {
                            setEditTarget(s);
                            setFormOpen(true);
                          }}
                          onDelete={() => handleDelete(s.id)}
                          onToggleActive={() => handleToggleActive(s.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted text-sm">No services found.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((s) => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  onEdit={() => {
                    setEditTarget(s);
                    setFormOpen(true);
                  }}
                  onDelete={() => handleDelete(s.id)}
                  onToggleActive={() => handleToggleActive(s.id)}
                />
              ))}
            </div>
          )}
        </>
      )}{" "}
      {/* end activeTab === "menu" */}
      {/* Form dialog */}
      <ServiceFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        initial={editTarget}
        onSave={handleSave}
      />
    </div>
  );
}
