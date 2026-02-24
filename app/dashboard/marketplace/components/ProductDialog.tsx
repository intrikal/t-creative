"use client";

import { useState } from "react";
import { Dialog, Field, Input, Textarea, Select, DialogFooter } from "@/components/ui/dialog";
import type { ProductForm } from "./helpers";

export function ProductDialog({
  open,
  onClose,
  initial,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  initial: ProductForm;
  onSave: (form: ProductForm) => void;
  saving: boolean;
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
          onConfirm={() => onSave(form)}
          confirmLabel={saving ? "Saving…" : initial.name ? "Save changes" : "Add product"}
          disabled={!valid || saving}
        />
      </div>
    </Dialog>
  );
}
