"use client";

/**
 * PaymentsSection.tsx — Saved payment methods tab for the client settings page.
 *
 * Displays saved cards with set-default and remove actions. The "Add payment
 * method" button is a placeholder — Phase 2 will open a Stripe Elements sheet
 * or Square payment form to tokenise and vault the new card.
 *
 * Card data is currently mock (`INITIAL_CARDS`). Phase 2 will fetch real payment
 * methods from the Square API (linked via the client's `squareCustomerId`).
 */

import { useState } from "react";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { INITIAL_CARDS, type PaymentMethod } from "../client-types";

/**
 * PaymentsSection — lists saved cards with set-default + remove controls.
 * Mutations are local-only (no server action yet).
 */
export function PaymentsSection() {
  const [cards, setCards] = useState<PaymentMethod[]>(INITIAL_CARDS);

  function setDefaultCard(id: string) {
    setCards((prev) => prev.map((c) => ({ ...c, isDefault: c.id === id })));
  }

  function removeCard(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <Card className="gap-0">
      <CardContent className="px-5 py-5 space-y-4">
        <p className="text-sm font-semibold text-foreground">Payment Methods</p>

        {cards.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-border rounded-xl">
            <CreditCard className="w-6 h-6 text-muted/40 mx-auto mb-2" />
            <p className="text-sm text-muted">No payment methods saved</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cards.map((card) => (
              <div
                key={card.id}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface"
              >
                <div className="w-9 h-6 rounded bg-foreground/8 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4 text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {card.brand} •••• {card.last4}
                  </p>
                  <p className="text-xs text-muted mt-0.5">Expires {card.expiry}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {card.isDefault ? (
                    <span className="text-[10px] font-medium text-[#4e6b51] bg-[#4e6b51]/10 border border-[#4e6b51]/20 px-1.5 py-0.5 rounded-full">
                      Default
                    </span>
                  ) : (
                    <button
                      onClick={() => setDefaultCard(card.id)}
                      className="text-[10px] text-muted hover:text-foreground transition-colors"
                    >
                      Set default
                    </button>
                  )}
                  <button
                    onClick={() => removeCard(card.id)}
                    className="p-1 rounded-md text-muted hover:text-destructive hover:bg-destructive/8 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-sm font-medium text-muted hover:text-foreground hover:border-foreground/30 transition-colors">
          <Plus className="w-4 h-4" />
          Add payment method
        </button>

        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted leading-relaxed">
            Payment methods are used for shop orders, training deposits, and service add-ons. Card
            data is encrypted and stored securely.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
