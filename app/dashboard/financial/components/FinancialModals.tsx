/**
 * Financial form dialogs — New Invoice, Log Expense, Issue Gift Card, New Promo.
 *
 * Each form collects user input and calls the corresponding server action
 * from `../actions.ts` on submit, then closes the dialog.
 *
 * @module financial/components/FinancialModals
 * @see {@link ../actions.ts} — `createInvoice`, `createExpense`, `createGiftCard`, `createPromotion`
 */
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, Field, Input, Select, Textarea, DialogFooter } from "@/components/ui/dialog";
import { createInvoice, createExpense, createGiftCard, createPromotion } from "../actions";

type ModalType = "invoice" | "expense" | "giftcard" | "promo" | null;

export function FinancialModals({ modal, onClose }: { modal: ModalType; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleClose() {
    setError(null);
    onClose();
  }

  function handleInvoiceSubmit() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const clientId = (data.get("clientId") as string)?.trim();
    const description = (data.get("description") as string)?.trim();
    const amount = parseFloat(data.get("amount") as string);
    const dueAt = data.get("dueAt") as string;

    if (!clientId || !description || !amount) {
      setError("Please fill in all required fields.");
      return;
    }

    startTransition(async () => {
      try {
        const isRecurring = data.get("isRecurring") === "yes";
        await createInvoice({
          clientId,
          description,
          amountInCents: Math.round(amount * 100),
          dueAt: dueAt || undefined,
          notes: (data.get("notes") as string)?.trim() || undefined,
          isRecurring,
          recurrenceInterval: isRecurring
            ? (data.get("recurrenceInterval") as string) || "monthly"
            : undefined,
        });
        router.refresh();
        handleClose();
      } catch {
        setError("Failed to create invoice. Check client ID is valid.");
      }
    });
  }

  function handleExpenseSubmit() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const expenseDate = data.get("expenseDate") as string;
    const category = data.get("category") as string;
    const description = (data.get("description") as string)?.trim();
    const amount = parseFloat(data.get("amount") as string);
    const hasReceipt = data.get("receipt") === "yes";

    if (!expenseDate || !category || !description || !amount) {
      setError("Please fill in all required fields.");
      return;
    }

    startTransition(async () => {
      try {
        await createExpense({
          expenseDate,
          category: category.toLowerCase() as
            | "supplies"
            | "rent"
            | "marketing"
            | "equipment"
            | "software"
            | "travel"
            | "other",
          description,
          vendor: (data.get("vendor") as string)?.trim() || undefined,
          amountInCents: Math.round(amount * 100),
          hasReceipt,
        });
        router.refresh();
        handleClose();
      } catch {
        setError("Failed to log expense.");
      }
    });
  }

  function handleGiftCardSubmit() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const amount = parseFloat(data.get("amount") as string);

    if (!amount) {
      setError("Please enter an amount.");
      return;
    }

    startTransition(async () => {
      try {
        await createGiftCard({
          recipientName: (data.get("recipient") as string)?.trim() || undefined,
          amountInCents: Math.round(amount * 100),
          expiresAt: (data.get("expiresAt") as string) || undefined,
          notes: (data.get("notes") as string)?.trim() || undefined,
        });
        router.refresh();
        handleClose();
      } catch {
        setError("Failed to issue gift card.");
      }
    });
  }

  function handlePromoSubmit() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const code = (data.get("code") as string)?.trim();
    const discountType = data.get("discountType") as string;
    const discountValue = parseInt(data.get("discountValue") as string, 10);

    if (!code || !discountType || !discountValue) {
      setError("Please fill in all required fields.");
      return;
    }

    const appliesTo = data.get("appliesTo") as string;

    startTransition(async () => {
      try {
        await createPromotion({
          code,
          discountType: discountType as "percent" | "fixed" | "bogo",
          discountValue: discountType === "fixed" ? Math.round(discountValue * 100) : discountValue,
          description: (data.get("description") as string)?.trim() || undefined,
          appliesTo:
            appliesTo && appliesTo !== "all"
              ? (appliesTo as "lash" | "jewelry" | "crochet" | "consulting")
              : undefined,
          maxUses: parseInt(data.get("maxUses") as string, 10) || undefined,
          startsAt: (data.get("startsAt") as string) || undefined,
          endsAt: (data.get("endsAt") as string) || undefined,
        });
        router.refresh();
        handleClose();
      } catch {
        setError("Failed to create promotion. Code may already exist.");
      }
    });
  }

  return (
    <>
      <Dialog
        open={modal === "invoice"}
        onClose={handleClose}
        title="New Invoice"
        description="Send an invoice to a client for services rendered."
      >
        <form
          ref={modal === "invoice" ? formRef : undefined}
          onSubmit={(e) => e.preventDefault()}
          className="space-y-4"
        >
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Field label="Client ID" required>
            <Input name="clientId" placeholder="Client UUID" />
          </Field>
          <Field label="Services / Description" required>
            <Textarea name="description" rows={2} placeholder="e.g. Volume Lashes — Full Set" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount ($)" required>
              <Input name="amount" type="number" placeholder="0.00" min={0} step={0.01} />
            </Field>
            <Field label="Due Date">
              <Input name="dueAt" type="date" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Recurring">
              <Select name="isRecurring">
                <option value="no">One-time</option>
                <option value="yes">Recurring</option>
              </Select>
            </Field>
            <Field label="Interval">
              <Select name="recurrenceInterval">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </Select>
            </Field>
          </div>
          <Field label="Notes">
            <Textarea name="notes" rows={2} placeholder="Any additional notes for the client…" />
          </Field>
          <DialogFooter
            onCancel={handleClose}
            onConfirm={handleInvoiceSubmit}
            confirmLabel={isPending ? "Saving…" : "Send Invoice"}
          />
        </form>
      </Dialog>

      <Dialog
        open={modal === "expense"}
        onClose={handleClose}
        title="Log Expense"
        description="Record a business expense for your records."
      >
        <form
          ref={modal === "expense" ? formRef : undefined}
          onSubmit={(e) => e.preventDefault()}
          className="space-y-4"
        >
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" required>
              <Input name="expenseDate" type="date" />
            </Field>
            <Field label="Category" required>
              <Select name="category">
                <option value="">Select…</option>
                {["Supplies", "Rent", "Marketing", "Equipment", "Software", "Travel", "Other"].map(
                  (c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ),
                )}
              </Select>
            </Field>
          </div>
          <Field label="Description" required>
            <Input name="description" placeholder="e.g. Monthly lash supply restock" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vendor">
              <Input name="vendor" placeholder="e.g. Beauty Supply Co" />
            </Field>
            <Field label="Amount ($)" required>
              <Input name="amount" type="number" placeholder="0.00" min={0} step={0.01} />
            </Field>
          </div>
          <Field label="Receipt">
            <Select name="receipt">
              <option value="yes">Receipt attached</option>
              <option value="no">No receipt</option>
            </Select>
          </Field>
          <DialogFooter
            onCancel={handleClose}
            onConfirm={handleExpenseSubmit}
            confirmLabel={isPending ? "Saving…" : "Log Expense"}
          />
        </form>
      </Dialog>

      <Dialog
        open={modal === "giftcard"}
        onClose={handleClose}
        title="Issue Gift Card"
        description="Create a new gift card for a client or recipient."
      >
        <form
          ref={modal === "giftcard" ? formRef : undefined}
          onSubmit={(e) => e.preventDefault()}
          className="space-y-4"
        >
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Recipient">
              <Input name="recipient" placeholder="Recipient name" />
            </Field>
            <Field label="Amount ($)" required>
              <Input name="amount" type="number" placeholder="0.00" min={1} step={1} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expiry Date">
              <Input name="expiresAt" type="date" />
            </Field>
            <Field label="Notes">
              <Input name="notes" placeholder="e.g. Birthday gift" />
            </Field>
          </div>
          <DialogFooter
            onCancel={handleClose}
            onConfirm={handleGiftCardSubmit}
            confirmLabel={isPending ? "Saving…" : "Issue Gift Card"}
          />
        </form>
      </Dialog>

      <Dialog
        open={modal === "promo"}
        onClose={handleClose}
        title="New Promotion"
        description="Create a discount code or offer for your clients."
      >
        <form
          ref={modal === "promo" ? formRef : undefined}
          onSubmit={(e) => e.preventDefault()}
          className="space-y-4"
        >
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Promo Code" required>
              <Input
                name="code"
                placeholder="e.g. SUMMER25"
                style={{ textTransform: "uppercase" }}
              />
            </Field>
            <Field label="Discount Type" required>
              <Select name="discountType">
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed amount ($)</option>
                <option value="bogo">Buy one get one</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount Value" required>
              <Input name="discountValue" type="number" placeholder="e.g. 20" min={1} />
            </Field>
            <Field label="Max Uses">
              <Input name="maxUses" type="number" placeholder="Leave blank for unlimited" min={1} />
            </Field>
          </div>
          <Field label="Applies To">
            <Select name="appliesTo">
              <option value="all">All services</option>
              <option value="lash">Lash services only</option>
              <option value="jewelry">Jewelry only</option>
              <option value="crochet">Crochet only</option>
              <option value="consulting">Consulting only</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date">
              <Input name="startsAt" type="date" />
            </Field>
            <Field label="End Date">
              <Input name="endsAt" type="date" />
            </Field>
          </div>
          <Field label="Description">
            <Input name="description" placeholder="Brief note about this promo…" />
          </Field>
          <DialogFooter
            onCancel={handleClose}
            onConfirm={handlePromoSubmit}
            confirmLabel={isPending ? "Saving…" : "Create Promo"}
          />
        </form>
      </Dialog>
    </>
  );
}
