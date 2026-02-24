import type {
  ProductRow,
  ProductCategory,
  PricingType,
  ProductStatus,
  ProductFormData,
  SupplyRow,
  SupplyFormData,
} from "../actions";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const LOW_STOCK_THRESHOLD = 5;

export const CATEGORY_CONFIG: Record<ProductCategory, { label: string; className: string }> = {
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

export function statusConfig(status: ProductStatus) {
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

export function priceDisplay(p: ProductRow) {
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
/*  Product form                                                       */
/* ------------------------------------------------------------------ */

export type ProductForm = {
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

export function emptyProductForm(): ProductForm {
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

export function productToForm(p: ProductRow): ProductForm {
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

export function formToData(form: ProductForm): ProductFormData {
  return {
    name: form.name,
    category: form.category,
    description: form.description,
    pricingType: form.pricingType,
    price: Number(form.price) || 0,
    priceMax: form.priceMax ? Number(form.priceMax) : undefined,
    stock: form.stock !== "" ? Number(form.stock) : undefined,
    status: form.status,
    tags: form.tags,
  };
}

/* ------------------------------------------------------------------ */
/*  Supply form                                                        */
/* ------------------------------------------------------------------ */

export type SupplyForm = {
  name: string;
  category: string;
  unit: string;
  stock: string;
  reorder: string;
};

export function emptySupplyForm(): SupplyForm {
  return { name: "", category: "Lash", unit: "", stock: "", reorder: "" };
}

export function supplyToForm(c: SupplyRow): SupplyForm {
  return {
    name: c.name,
    category: c.category,
    unit: c.unit,
    stock: String(c.stock),
    reorder: String(c.reorder),
  };
}

export function supplyFormToData(form: SupplyForm): SupplyFormData {
  return {
    name: form.name,
    category: form.category,
    unit: form.unit,
    stock: Number(form.stock) || 0,
    reorder: Number(form.reorder) || 0,
  };
}
