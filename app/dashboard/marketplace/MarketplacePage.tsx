"use client";

import { useState } from "react";
import {
  Plus,
  Tag,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Trash2,
  AlertTriangle,
  Minus,
  Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, Field, Input, Textarea, Select, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type ProductCategory = "lash-supplies" | "jewelry" | "crochet" | "aftercare" | "merch";
type PricingType = "fixed" | "starting_at" | "range" | "custom_quote";
type ProductStatus = "active" | "inactive" | "out_of_stock";
type ConsumableCategory = "Lash" | "Jewelry" | "Aftercare" | "Other";

interface Product {
  id: number;
  name: string;
  category: ProductCategory;
  description: string;
  pricingType: PricingType;
  price: number;
  priceMax?: number;
  stock?: number;
  status: ProductStatus;
  tags: string[];
  sales: number;
}

interface Consumable {
  id: number;
  name: string;
  category: ConsumableCategory;
  unit: string;
  stock: number;
  reorder: number;
  lastRestocked: string;
}

/* ------------------------------------------------------------------ */
/*  Initial mock data                                                   */
/* ------------------------------------------------------------------ */

const INITIAL_PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Lash Aftercare Kit",
    category: "aftercare",
    description:
      "Includes lash cleanser, spoolie, and aftercare card. Sold at appointment or shipped.",
    pricingType: "fixed",
    price: 18,
    stock: 24,
    status: "active",
    tags: ["aftercare", "lash"],
    sales: 47,
  },
  {
    id: 2,
    name: "Custom Permanent Jewelry",
    category: "jewelry",
    description:
      "14k gold-filled chains — bracelets, anklets, necklaces. Welded on-site. Price varies by chain.",
    pricingType: "starting_at",
    price: 55,
    status: "active",
    tags: ["permanent", "jewelry"],
    sales: 89,
  },
  {
    id: 3,
    name: "Custom Crochet Set",
    category: "crochet",
    description: "Fully custom crochet install. Price depends on style, length, and hair type.",
    pricingType: "range",
    price: 80,
    priceMax: 220,
    status: "active",
    tags: ["crochet", "custom"],
    sales: 23,
  },
  {
    id: 4,
    name: "T Creative Lash Cleanser",
    category: "aftercare",
    description: "Private label foam cleanser, 60ml. Gentle on extensions, oil-free formula.",
    pricingType: "fixed",
    price: 14,
    stock: 11,
    status: "active",
    tags: ["cleanser", "aftercare"],
    sales: 62,
  },
  {
    id: 5,
    name: "Jewelry Matching Set",
    category: "jewelry",
    description: "Coordinating bracelet + anklet combo. Perfect for gifting.",
    pricingType: "starting_at",
    price: 110,
    status: "active",
    tags: ["matching", "jewelry", "gift"],
    sales: 18,
  },
  {
    id: 6,
    name: "T Creative Tote Bag",
    category: "merch",
    description: "Canvas tote with TC logo. Limited run.",
    pricingType: "fixed",
    price: 28,
    stock: 3,
    status: "active",
    tags: ["merch", "tote"],
    sales: 14,
  },
  {
    id: 7,
    name: "Lash Spoolie Set (5pk)",
    category: "lash-supplies",
    description: "Disposable mascara wands for client maintenance between fills.",
    pricingType: "fixed",
    price: 5,
    stock: 0,
    status: "out_of_stock",
    tags: ["spoolie", "lash"],
    sales: 33,
  },
  {
    id: 8,
    name: "Business Consulting Package",
    category: "lash-supplies",
    description: "Custom consulting package — HR, team building, operations.",
    pricingType: "custom_quote",
    price: 150,
    status: "inactive",
    tags: ["consulting"],
    sales: 8,
  },
];

const INITIAL_CONSUMABLES: Consumable[] = [
  {
    id: 1,
    name: "Lash Glue (Sensitive)",
    category: "Lash",
    unit: "bottles",
    stock: 2,
    reorder: 3,
    lastRestocked: "Jan 28",
  },
  {
    id: 2,
    name: "Lash Glue (Volume)",
    category: "Lash",
    unit: "bottles",
    stock: 1,
    reorder: 3,
    lastRestocked: "Jan 15",
  },
  {
    id: 3,
    name: "Classic Lash Trays (C curl, 0.15mm)",
    category: "Lash",
    unit: "trays",
    stock: 8,
    reorder: 5,
    lastRestocked: "Feb 1",
  },
  {
    id: 4,
    name: "Volume Lash Fans (D curl, 0.07mm)",
    category: "Lash",
    unit: "trays",
    stock: 12,
    reorder: 5,
    lastRestocked: "Feb 1",
  },
  {
    id: 5,
    name: "Lash Under-Eye Tape",
    category: "Lash",
    unit: "rolls",
    stock: 4,
    reorder: 3,
    lastRestocked: "Feb 5",
  },
  {
    id: 6,
    name: "Jade Rings (adhesive)",
    category: "Lash",
    unit: "packs",
    stock: 6,
    reorder: 4,
    lastRestocked: "Feb 3",
  },
  {
    id: 7,
    name: "14k Gold-Fill Chain (bracelet)",
    category: "Jewelry",
    unit: "feet",
    stock: 1,
    reorder: 3,
    lastRestocked: "Jan 20",
  },
  {
    id: 8,
    name: "14k Gold-Fill Chain (anklet)",
    category: "Jewelry",
    unit: "feet",
    stock: 4,
    reorder: 3,
    lastRestocked: "Jan 20",
  },
  {
    id: 9,
    name: "Micro Welder Tips (spare)",
    category: "Jewelry",
    unit: "tips",
    stock: 8,
    reorder: 5,
    lastRestocked: "Dec 15",
  },
  {
    id: 10,
    name: "Lash Foam Cleanser (private label)",
    category: "Aftercare",
    unit: "bottles",
    stock: 11,
    reorder: 8,
    lastRestocked: "Feb 10",
  },
  {
    id: 11,
    name: "Spoolie Wands (disposable)",
    category: "Aftercare",
    unit: "packs",
    stock: 0,
    reorder: 3,
    lastRestocked: "Jan 5",
  },
];

const LOW_STOCK_THRESHOLD = 5;

/* ------------------------------------------------------------------ */
/*  Display helpers                                                     */
/* ------------------------------------------------------------------ */

const CATEGORY_CONFIG: Record<ProductCategory, { label: string; className: string }> = {
  "lash-supplies": {
    label: "Lash Supplies",
    className: "bg-[#c4907a]/12 text-[#96604a] border-[#c4907a]/20",
  },
  jewelry: { label: "Jewelry", className: "bg-[#d4a574]/12 text-[#a07040] border-[#d4a574]/20" },
  crochet: { label: "Crochet", className: "bg-[#7ba3a3]/12 text-[#4a7a7a] border-[#7ba3a3]/20" },
  aftercare: {
    label: "Aftercare",
    className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20",
  },
  merch: { label: "Merch", className: "bg-accent/12 text-accent border-accent/20" },
};

function statusConfig(status: ProductStatus) {
  switch (status) {
    case "active":
      return { label: "Active", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "inactive":
      return { label: "Inactive", className: "bg-foreground/8 text-muted border-foreground/12" };
    case "out_of_stock":
      return {
        label: "Out of Stock",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      };
  }
}

function priceDisplay(p: Product) {
  switch (p.pricingType) {
    case "fixed":
      return `$${p.price}`;
    case "starting_at":
      return `From $${p.price}`;
    case "range":
      return `$${p.price}–$${p.priceMax}`;
    case "custom_quote":
      return "Custom Quote";
  }
}

/* ------------------------------------------------------------------ */
/*  Product form state                                                  */
/* ------------------------------------------------------------------ */

type ProductForm = {
  name: string;
  category: ProductCategory;
  description: string;
  pricingType: PricingType;
  price: string;
  priceMax: string;
  stock: string;
  status: ProductStatus;
  tags: string;
};

function emptyProductForm(): ProductForm {
  return {
    name: "",
    category: "lash-supplies",
    description: "",
    pricingType: "fixed",
    price: "",
    priceMax: "",
    stock: "",
    status: "active",
    tags: "",
  };
}

function productToForm(p: Product): ProductForm {
  return {
    name: p.name,
    category: p.category,
    description: p.description,
    pricingType: p.pricingType,
    price: String(p.price),
    priceMax: p.priceMax != null ? String(p.priceMax) : "",
    stock: p.stock != null ? String(p.stock) : "",
    status: p.status,
    tags: p.tags.join(", "),
  };
}

/* ------------------------------------------------------------------ */
/*  Consumable form state                                               */
/* ------------------------------------------------------------------ */

type ConsumableForm = {
  name: string;
  category: ConsumableCategory;
  unit: string;
  stock: string;
  reorder: string;
};

function emptyConsumableForm(): ConsumableForm {
  return { name: "", category: "Lash", unit: "", stock: "", reorder: "" };
}

function consumableToForm(c: Consumable): ConsumableForm {
  return {
    name: c.name,
    category: c.category,
    unit: c.unit,
    stock: String(c.stock),
    reorder: String(c.reorder),
  };
}

/* ------------------------------------------------------------------ */
/*  Product card                                                        */
/* ------------------------------------------------------------------ */

function ProductCard({
  product,
  onEdit,
  onDelete,
  onToggle,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const cat = CATEGORY_CONFIG[product.category];
  const sts = statusConfig(product.status);
  const isActive = product.status === "active";

  return (
    <Card className="gap-0 h-full">
      <CardContent className="px-5 pt-5 pb-4 flex flex-col h-full">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground leading-snug">{product.name}</h3>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Badge className={cn("border text-[10px] px-1.5 py-0.5", cat.className)}>
                {cat.label}
              </Badge>
              <Badge className={cn("border text-[10px] px-1.5 py-0.5", sts.className)}>
                {sts.label}
              </Badge>
            </div>
          </div>
          <button
            onClick={onToggle}
            title={isActive ? "Deactivate" : "Activate"}
            className={cn(
              "shrink-0 transition-colors mt-0.5",
              isActive ? "text-[#4e6b51]" : "text-muted",
            )}
          >
            {isActive ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
          </button>
        </div>
        <p className="text-xs text-muted mt-2.5 leading-relaxed flex-1">{product.description}</p>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50">
          <span className="text-sm font-semibold text-foreground flex items-center gap-1">
            <Tag className="w-3 h-3 text-muted" />
            {priceDisplay(product)}
          </span>
          {product.stock !== undefined && (
            <span
              className={cn(
                "text-xs",
                product.stock === 0
                  ? "text-destructive"
                  : product.stock <= LOW_STOCK_THRESHOLD
                    ? "text-[#7a5c10]"
                    : "text-muted",
              )}
            >
              {product.stock === 0 ? "Out of stock" : `${product.stock} in stock`}
            </span>
          )}
          <span className="text-xs text-muted ml-auto">{product.sales} sold</span>
        </div>
        <div className="flex items-center gap-1 mt-3">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-foreground/5"
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-destructive transition-colors px-2.5 py-1.5 rounded-lg hover:bg-destructive/5 ml-auto"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Product dialog                                                      */
/* ------------------------------------------------------------------ */

function ProductDialog({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: ProductForm;
  onSave: (form: ProductForm) => void;
}) {
  const [form, setForm] = useState<ProductForm>(initial);
  const set =
    (field: keyof ProductForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  const valid =
    form.name.trim() !== "" && (form.pricingType === "custom_quote" || form.price !== "");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial.name ? "Edit Product" : "New Product"}
      description="Add or update a product in your marketplace."
      size="md"
    >
      <div className="space-y-4" key={String(open)}>
        <Field label="Product name" required>
          <Input value={form.name} onChange={set("name")} placeholder="e.g. Lash Aftercare Kit" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" required>
            <Select value={form.category} onChange={set("category")}>
              <option value="lash-supplies">Lash Supplies</option>
              <option value="jewelry">Jewelry</option>
              <option value="crochet">Crochet</option>
              <option value="aftercare">Aftercare</option>
              <option value="merch">Merch</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="out_of_stock">Out of Stock</option>
            </Select>
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            value={form.description}
            onChange={set("description")}
            rows={3}
            placeholder="Describe the product…"
          />
        </Field>
        <Field label="Pricing type" required>
          <Select value={form.pricingType} onChange={set("pricingType")}>
            <option value="fixed">Fixed price</option>
            <option value="starting_at">Starting at</option>
            <option value="range">Price range</option>
            <option value="custom_quote">Custom quote</option>
          </Select>
        </Field>
        {form.pricingType !== "custom_quote" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={form.pricingType === "range" ? "Min price ($)" : "Price ($)"} required>
              <Input
                type="number"
                value={form.price}
                onChange={set("price")}
                placeholder="0"
                min={0}
              />
            </Field>
            {form.pricingType === "range" && (
              <Field label="Max price ($)" required>
                <Input
                  type="number"
                  value={form.priceMax}
                  onChange={set("priceMax")}
                  placeholder="0"
                  min={0}
                />
              </Field>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stock quantity" hint="Leave blank if not tracked">
            <Input
              type="number"
              value={form.stock}
              onChange={set("stock")}
              placeholder="e.g. 12"
              min={0}
            />
          </Field>
          <Field label="Tags" hint="Comma-separated">
            <Input value={form.tags} onChange={set("tags")} placeholder="lash, aftercare, kit" />
          </Field>
        </div>
        <DialogFooter
          onCancel={onClose}
          onConfirm={() => {
            onSave(form);
            onClose();
          }}
          confirmLabel={initial.name ? "Save changes" : "Add product"}
          disabled={!valid}
        />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Supply dialog                                                       */
/* ------------------------------------------------------------------ */

function SupplyDialog({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: ConsumableForm;
  onSave: (form: ConsumableForm) => void;
}) {
  const [form, setForm] = useState<ConsumableForm>(initial);
  const set =
    (field: keyof ConsumableForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  const valid = form.name.trim() !== "" && form.unit.trim() !== "";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial.name ? "Edit Supply" : "Add Supply"}
      description="Track a consumable used in your services."
      size="md"
    >
      <div className="space-y-4" key={String(open)}>
        <Field label="Item name" required>
          <Input
            value={form.name}
            onChange={set("name")}
            placeholder="e.g. Lash Glue (Sensitive)"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" required>
            <Select value={form.category} onChange={set("category")}>
              <option value="Lash">Lash</option>
              <option value="Jewelry">Jewelry</option>
              <option value="Aftercare">Aftercare</option>
              <option value="Other">Other</option>
            </Select>
          </Field>
          <Field label="Unit" required hint="e.g. bottles, trays, rolls">
            <Input value={form.unit} onChange={set("unit")} placeholder="e.g. bottles" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Current stock">
            <Input
              type="number"
              value={form.stock}
              onChange={set("stock")}
              placeholder="0"
              min={0}
            />
          </Field>
          <Field label="Reorder point" hint="Alert when stock hits this level">
            <Input
              type="number"
              value={form.reorder}
              onChange={set("reorder")}
              placeholder="e.g. 3"
              min={0}
            />
          </Field>
        </div>
        <DialogFooter
          onCancel={onClose}
          onConfirm={() => {
            onSave(form);
            onClose();
          }}
          confirmLabel={initial.name ? "Save changes" : "Add supply"}
          disabled={!valid}
        />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

const PAGE_TABS = ["Products", "Inventory", "Consumables"] as const;
type PageTab = (typeof PAGE_TABS)[number];

export function MarketplacePage() {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [consumables, setConsumables] = useState<Consumable[]>(INITIAL_CONSUMABLES);
  const [filter, setFilter] = useState<"all" | ProductCategory>("all");
  const [pageTab, setPageTab] = useState<PageTab>("Products");

  // Product dialog state
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Supply dialog state
  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<Consumable | null>(null);

  const filtered = filter === "all" ? products : products.filter((p) => p.category === filter);
  const activeCount = products.filter((p) => p.status === "active").length;
  const totalSales = products.reduce((s, p) => s + p.sales, 0);
  const trackedProducts = products.filter((p) => p.stock !== undefined);
  const lowStockCount = trackedProducts.filter(
    (p) => p.stock! > 0 && p.stock! <= LOW_STOCK_THRESHOLD,
  ).length;
  const outOfStockCount = trackedProducts.filter((p) => p.stock === 0).length;

  const consumableLowCount = consumables.filter((c) => c.stock > 0 && c.stock <= c.reorder).length;
  const consumableOutCount = consumables.filter((c) => c.stock === 0).length;

  // Product handlers
  function openNewProduct() {
    setEditingProduct(null);
    setProductDialogOpen(true);
  }
  function openEditProduct(p: Product) {
    setEditingProduct(p);
    setProductDialogOpen(true);
  }

  function handleSaveProduct(form: ProductForm) {
    if (editingProduct) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProduct.id
            ? {
                ...p,
                name: form.name,
                category: form.category,
                description: form.description,
                pricingType: form.pricingType,
                price: Number(form.price) || 0,
                priceMax: form.priceMax ? Number(form.priceMax) : undefined,
                stock: form.stock !== "" ? Number(form.stock) : undefined,
                status: form.status,
                tags: form.tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              }
            : p,
        ),
      );
    } else {
      setProducts((prev) => [
        {
          id: Date.now(),
          name: form.name,
          category: form.category,
          description: form.description,
          pricingType: form.pricingType,
          price: Number(form.price) || 0,
          priceMax: form.priceMax ? Number(form.priceMax) : undefined,
          stock: form.stock !== "" ? Number(form.stock) : undefined,
          status: form.status,
          tags: form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          sales: 0,
        },
        ...prev,
      ]);
    }
  }

  function handleDeleteProduct(id: number) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }
  function handleToggleProduct(id: number) {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: p.status === "active" ? "inactive" : "active" } : p,
      ),
    );
  }
  function adjustProductStock(id: number, delta: number) {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== id || p.stock === undefined) return p;
        const newStock = Math.max(0, p.stock + delta);
        return {
          ...p,
          stock: newStock,
          status:
            newStock === 0 ? "out_of_stock" : p.status === "out_of_stock" ? "active" : p.status,
        };
      }),
    );
  }

  // Supply handlers
  function openNewSupply() {
    setEditingSupply(null);
    setSupplyDialogOpen(true);
  }
  function openEditSupply(c: Consumable) {
    setEditingSupply(c);
    setSupplyDialogOpen(true);
  }

  function handleSaveSupply(form: ConsumableForm) {
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (editingSupply) {
      setConsumables((prev) =>
        prev.map((c) =>
          c.id === editingSupply.id
            ? {
                ...c,
                name: form.name,
                category: form.category,
                unit: form.unit,
                stock: Number(form.stock) || 0,
                reorder: Number(form.reorder) || 0,
              }
            : c,
        ),
      );
    } else {
      setConsumables((prev) => [
        ...prev,
        {
          id: Date.now(),
          name: form.name,
          category: form.category,
          unit: form.unit,
          stock: Number(form.stock) || 0,
          reorder: Number(form.reorder) || 0,
          lastRestocked: today,
        },
      ]);
    }
  }

  function handleDeleteSupply(id: number) {
    setConsumables((prev) => prev.filter((c) => c.id !== id));
  }
  function adjustConsumableStock(id: number, delta: number) {
    setConsumables((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return { ...c, stock: Math.max(0, c.stock + delta) };
      }),
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Marketplace</h1>
          <p className="text-sm text-muted mt-0.5">
            Manage your products, pricing, and availability
          </p>
        </div>
        {pageTab === "Products" && (
          <button
            onClick={openNewProduct}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Add Product
          </button>
        )}
        {pageTab === "Consumables" && (
          <button
            onClick={openNewSupply}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Add Supply
          </button>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Active Listings", value: activeCount },
          { label: "Total Products", value: products.length },
          { label: "Units Sold", value: totalSales },
          { label: "Low / Out of Stock", value: `${lowStockCount} / ${outOfStockCount}` },
        ].map((s) => (
          <Card key={s.label} className="gap-0 py-4">
            <CardContent className="px-4 text-center">
              <p className="text-2xl font-semibold text-foreground">{s.value}</p>
              <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border">
        {PAGE_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setPageTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              pageTab === t
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {t}
            {t === "Inventory" && (lowStockCount > 0 || outOfStockCount > 0) && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#7a5c10] text-white text-[9px] font-bold">
                {lowStockCount + outOfStockCount}
              </span>
            )}
            {t === "Consumables" && (consumableLowCount > 0 || consumableOutCount > 0) && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#7a5c10] text-white text-[9px] font-bold">
                {consumableLowCount + consumableOutCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Products tab ── */}
      {pageTab === "Products" && (
        <>
          {/* Category filter */}
          <div className="flex gap-1 flex-wrap">
            {(["all", "lash-supplies", "jewelry", "crochet", "aftercare", "merch"] as const).map(
              (f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    filter === f
                      ? "bg-foreground/8 text-foreground"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {f === "all" ? "All" : CATEGORY_CONFIG[f as ProductCategory].label}
                </button>
              ),
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <p className="text-sm text-muted">No products in this category.</p>
              <button onClick={openNewProduct} className="mt-2 text-sm text-accent hover:underline">
                + Add your first product
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {filtered.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onEdit={() => openEditProduct(p)}
                  onDelete={() => handleDeleteProduct(p.id)}
                  onToggle={() => handleToggleProduct(p.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Inventory tab ── */}
      {pageTab === "Inventory" && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Stock Inventory</CardTitle>
              <span className="text-xs text-muted">{trackedProducts.length} tracked items</span>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-surface/30">
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5 pt-1">
                      Product
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 pb-2.5 pt-1 hidden md:table-cell">
                      Category
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 pb-2.5 pt-1 hidden lg:table-cell">
                      Pricing
                    </th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 pb-2.5 pt-1">
                      Stock
                    </th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 pb-2.5 pt-1">
                      Status
                    </th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-4 pb-2.5 pt-1 hidden lg:table-cell">
                      Sold
                    </th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5 pt-1">
                      Adjust
                    </th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5 pt-1 hidden md:table-cell">
                      Edit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const cat = CATEGORY_CONFIG[p.category];
                    const sts = statusConfig(p.status);
                    const isLow =
                      p.stock !== undefined && p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD;
                    const isOut = p.stock === 0;
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                      >
                        <td className="px-5 py-3.5 align-middle">
                          <div>
                            <p className="text-sm font-medium text-foreground">{p.name}</p>
                            {isLow && (
                              <p className="text-[10px] text-[#7a5c10] flex items-center gap-0.5 mt-0.5">
                                <AlertTriangle className="w-3 h-3" /> Low stock
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell align-middle">
                          <Badge className={cn("border text-[10px] px-1.5 py-0.5", cat.className)}>
                            {cat.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell align-middle">
                          <span className="text-xs text-muted">{priceDisplay(p)}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center align-middle">
                          {p.stock !== undefined ? (
                            <span
                              className={cn(
                                "text-sm font-semibold tabular-nums",
                                isOut
                                  ? "text-destructive"
                                  : isLow
                                    ? "text-[#7a5c10]"
                                    : "text-foreground",
                              )}
                            >
                              {p.stock}
                            </span>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center align-middle">
                          <Badge className={cn("border text-[10px] px-1.5 py-0.5", sts.className)}>
                            {sts.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-right hidden lg:table-cell align-middle">
                          <span className="text-xs text-muted tabular-nums">{p.sales}</span>
                        </td>
                        <td className="px-5 py-3.5 text-center align-middle">
                          {p.stock !== undefined ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => adjustProductStock(p.id, -1)}
                                disabled={p.stock === 0}
                                className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted hover:bg-foreground/5 hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs tabular-nums w-6 text-center text-foreground font-medium">
                                {p.stock}
                              </span>
                              <button
                                onClick={() => adjustProductStock(p.id, 1)}
                                className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted hover:bg-foreground/5 hover:text-foreground transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => openEditProduct(p)}
                              className="text-[11px] text-accent hover:underline"
                            >
                              Enable
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center hidden md:table-cell align-middle">
                          <button
                            onClick={() => openEditProduct(p)}
                            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Consumables tab ── */}
      {pageTab === "Consumables" && (
        <div className="space-y-4">
          <div className="text-xs text-muted">
            Track supplies used in services — glue, chains, cleanser, lash trays, etc.
          </div>

          {/* Low stock alert */}
          {(consumableLowCount > 0 || consumableOutCount > 0) && (
            <div className="bg-[#c4907a]/8 border border-[#c4907a]/20 rounded-xl p-3 flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-[#c4907a] shrink-0" />
              <p className="text-xs text-foreground">
                <span className="font-semibold">
                  {consumableLowCount + consumableOutCount} item
                  {consumableLowCount + consumableOutCount !== 1 ? "s" : ""}
                </span>
                {consumableOutCount > 0 && consumableLowCount > 0
                  ? ` (${consumableOutCount} out, ${consumableLowCount} low)`
                  : consumableOutCount > 0
                    ? ` out of stock`
                    : ` below reorder point`}{" "}
                — need restocking.
              </p>
            </div>
          )}

          {consumables.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <Package className="w-8 h-8 text-muted mx-auto mb-3" />
              <p className="text-sm text-muted">No supplies tracked yet.</p>
              <button onClick={openNewSupply} className="mt-2 text-sm text-accent hover:underline">
                + Add your first supply
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-surface/40">
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-5 py-2.5">
                      Item
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 hidden md:table-cell">
                      Category
                    </th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5">
                      In Stock
                    </th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 hidden sm:table-cell">
                      Reorder At
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 hidden lg:table-cell">
                      Last Restocked
                    </th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5">
                      Status
                    </th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-5 py-2.5">
                      Adjust
                    </th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-5 py-2.5 hidden md:table-cell">
                      Edit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {consumables.map((item) => {
                    const isOut = item.stock === 0;
                    const isLow = !isOut && item.stock <= item.reorder;
                    const statusColor = isOut
                      ? "text-destructive bg-destructive/10 border-destructive/20"
                      : isLow
                        ? "text-[#a07040] bg-[#a07040]/10 border-[#a07040]/20"
                        : "text-[#4e6b51] bg-[#4e6b51]/10 border-[#4e6b51]/20";
                    const statusLabel = isOut ? "Out" : isLow ? "Low" : "OK";
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                      >
                        <td className="px-5 py-3.5 align-middle">
                          <p className="text-sm font-medium text-foreground">{item.name}</p>
                          <p className="text-[10px] text-muted">{item.unit}</p>
                        </td>
                        <td className="px-4 py-3.5 align-middle hidden md:table-cell">
                          <span className="text-xs text-muted">{item.category}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center align-middle">
                          <span
                            className={cn(
                              "text-sm font-semibold tabular-nums",
                              isOut
                                ? "text-destructive"
                                : isLow
                                  ? "text-[#7a5c10]"
                                  : "text-foreground",
                            )}
                          >
                            {item.stock}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center align-middle hidden sm:table-cell">
                          <span className="text-xs text-muted tabular-nums">{item.reorder}</span>
                        </td>
                        <td className="px-4 py-3.5 align-middle hidden lg:table-cell">
                          <span className="text-xs text-muted">{item.lastRestocked}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center align-middle">
                          <span
                            className={cn(
                              "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                              statusColor,
                            )}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center align-middle">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => adjustConsumableStock(item.id, -1)}
                              disabled={item.stock === 0}
                              className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted hover:bg-foreground/5 hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs tabular-nums w-6 text-center text-foreground font-medium">
                              {item.stock}
                            </span>
                            <button
                              onClick={() => adjustConsumableStock(item.id, 1)}
                              className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted hover:bg-foreground/5 hover:text-foreground transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-center hidden md:table-cell align-middle">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditSupply(item)}
                              className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSupply(item.id)}
                              className="p-1.5 rounded-lg text-muted hover:text-destructive hover:bg-destructive/5 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Product dialog */}
      <ProductDialog
        key={editingProduct?.id ?? "new-product"}
        open={productDialogOpen}
        onClose={() => setProductDialogOpen(false)}
        initial={editingProduct ? productToForm(editingProduct) : emptyProductForm()}
        onSave={handleSaveProduct}
      />

      {/* Supply dialog */}
      <SupplyDialog
        key={editingSupply?.id ?? "new-supply"}
        open={supplyDialogOpen}
        onClose={() => setSupplyDialogOpen(false)}
        initial={editingSupply ? consumableToForm(editingSupply) : emptyConsumableForm()}
        onSave={handleSaveSupply}
      />
    </div>
  );
}
