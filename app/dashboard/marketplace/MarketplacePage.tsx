"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ProductRow, SupplyRow, MarketplaceStats, ProductCategory } from "./actions";
import {
  createProduct,
  updateProduct,
  deleteProduct as deleteProductAction,
  toggleProductStatus,
  adjustProductStock,
  createSupply,
  updateSupply,
  deleteSupply as deleteSupplyAction,
  adjustSupplyStock,
} from "./actions";
import {
  emptyProductForm,
  productToForm,
  formToData,
  emptySupplyForm,
  supplyToForm,
  supplyFormToData,
  LOW_STOCK_THRESHOLD,
} from "./components/helpers";
import type { ProductForm, SupplyForm } from "./components/helpers";
import { InventoryTab } from "./components/InventoryTab";
import { ProductDialog } from "./components/ProductDialog";
import { ProductsTab } from "./components/ProductsTab";
import { SuppliesTab } from "./components/SuppliesTab";
import { SupplyDialog } from "./components/SupplyDialog";

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

const PAGE_TABS = ["Products", "Inventory", "Supplies"] as const;
type PageTab = (typeof PAGE_TABS)[number];

export function MarketplacePage({
  initialProducts,
  initialSupplies,
  stats,
}: {
  initialProducts: ProductRow[];
  initialSupplies: SupplyRow[];
  stats: MarketplaceStats;
}) {
  const [filter, setFilter] = useState<"all" | ProductCategory>("all");
  const [pageTab, setPageTab] = useState<PageTab>("Products");
  const [isPending, startTransition] = useTransition();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // Product dialog state
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);

  // Supply dialog state
  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<SupplyRow | null>(null);

  // Derived counts
  const trackedProducts = initialProducts.filter((p) => p.stock !== undefined);
  const lowStockCount = trackedProducts.filter(
    (p) => p.stock! > 0 && p.stock! <= LOW_STOCK_THRESHOLD,
  ).length;
  const outOfStockCount = trackedProducts.filter((p) => p.stock === 0).length;
  const supplyLowCount = initialSupplies.filter((c) => c.stock > 0 && c.stock <= c.reorder).length;
  const supplyOutCount = initialSupplies.filter((c) => c.stock === 0).length;

  // Pending helpers
  function markPending(key: string) {
    setPendingIds((prev) => new Set(prev).add(key));
  }
  function clearPending(key: string) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  // Product handlers
  function openNewProduct() {
    setEditingProduct(null);
    setProductDialogOpen(true);
  }
  function openEditProduct(p: ProductRow) {
    setEditingProduct(p);
    setProductDialogOpen(true);
  }

  function handleSaveProduct(form: ProductForm) {
    const data = formToData(form);
    startTransition(async () => {
      if (editingProduct) {
        await updateProduct(editingProduct.id, data);
      } else {
        await createProduct(data);
      }
      setProductDialogOpen(false);
    });
  }

  function handleDeleteProduct(id: number) {
    markPending(`p-${id}`);
    startTransition(async () => {
      await deleteProductAction(id);
      clearPending(`p-${id}`);
    });
  }

  function handleToggleProduct(id: number) {
    markPending(`p-${id}`);
    startTransition(async () => {
      await toggleProductStatus(id);
      clearPending(`p-${id}`);
    });
  }

  function handleAdjustProductStock(id: number, delta: number) {
    markPending(`p-${id}`);
    startTransition(async () => {
      await adjustProductStock(id, delta);
      clearPending(`p-${id}`);
    });
  }

  // Supply handlers
  function openNewSupply() {
    setEditingSupply(null);
    setSupplyDialogOpen(true);
  }
  function openEditSupply(c: SupplyRow) {
    setEditingSupply(c);
    setSupplyDialogOpen(true);
  }

  function handleSaveSupply(form: SupplyForm) {
    const data = supplyFormToData(form);
    startTransition(async () => {
      if (editingSupply) {
        await updateSupply(editingSupply.id, data);
      } else {
        await createSupply(data);
      }
      setSupplyDialogOpen(false);
    });
  }

  function handleDeleteSupply(id: number) {
    markPending(`s-${id}`);
    startTransition(async () => {
      await deleteSupplyAction(id);
      clearPending(`s-${id}`);
    });
  }

  function handleAdjustSupplyStock(id: number, delta: number) {
    markPending(`s-${id}`);
    startTransition(async () => {
      await adjustSupplyStock(id, delta);
      clearPending(`s-${id}`);
    });
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
        {pageTab === "Supplies" && (
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
          { label: "Active Listings", value: stats.activeCount },
          { label: "Total Products", value: stats.totalProducts },
          { label: "Units Sold", value: stats.totalSales },
          {
            label: "Low / Out of Stock",
            value: `${stats.lowStockCount} / ${stats.outOfStockCount}`,
          },
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
            {t === "Supplies" && (supplyLowCount > 0 || supplyOutCount > 0) && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#7a5c10] text-white text-[9px] font-bold">
                {supplyLowCount + supplyOutCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {pageTab === "Products" && (
        <ProductsTab
          products={initialProducts}
          filter={filter}
          setFilter={setFilter}
          pendingIds={pendingIds}
          onNew={openNewProduct}
          onEdit={openEditProduct}
          onDelete={handleDeleteProduct}
          onToggle={handleToggleProduct}
        />
      )}

      {pageTab === "Inventory" && (
        <InventoryTab
          products={initialProducts}
          pendingIds={pendingIds}
          onAdjustStock={handleAdjustProductStock}
          onEdit={openEditProduct}
        />
      )}

      {pageTab === "Supplies" && (
        <SuppliesTab
          supplies={initialSupplies}
          pendingIds={pendingIds}
          onNew={openNewSupply}
          onEdit={openEditSupply}
          onDelete={handleDeleteSupply}
          onAdjustStock={handleAdjustSupplyStock}
        />
      )}

      {/* Product dialog */}
      <ProductDialog
        key={editingProduct?.id ?? "new-product"}
        open={productDialogOpen}
        onClose={() => setProductDialogOpen(false)}
        initial={editingProduct ? productToForm(editingProduct) : emptyProductForm()}
        onSave={handleSaveProduct}
        saving={isPending}
      />

      {/* Supply dialog */}
      <SupplyDialog
        key={editingSupply?.id ?? "new-supply"}
        open={supplyDialogOpen}
        onClose={() => setSupplyDialogOpen(false)}
        initial={editingSupply ? supplyToForm(editingSupply) : emptySupplyForm()}
        onSave={handleSaveSupply}
        saving={isPending}
      />
    </div>
  );
}
