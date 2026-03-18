/**
 * OrdersList -- renders the "Order History" tab content with status badges
 * and pricing for each past order.
 *
 * @see ../ShopPage.tsx  (parent)
 * @see ./shop-helpers.ts  (ORDER_STATUS_CONFIG)
 */
"use client";

import { Package, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type ClientOrder } from "@/app/shop/actions";
import { ORDER_STATUS_CONFIG } from "./shop-helpers";

export function OrdersList({ orders }: { orders: ClientOrder[] }) {
  return (
    <div className="space-y-3">
      {orders.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-2xl">
          <Package className="w-8 h-8 text-muted/40 mx-auto mb-2" />
          <p className="text-sm text-muted">No orders yet</p>
        </div>
      ) : (
        orders.map((order) => {
          const s = ORDER_STATUS_CONFIG[order.status] ?? ORDER_STATUS_CONFIG.accepted;
          return (
            <Card key={order.id} className="gap-0">
              <CardContent className="px-5 py-4 flex items-center gap-4">
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                    order.status === "completed" ? "bg-[#4e6b51]/10" : "bg-accent/10",
                  )}
                >
                  {order.status === "completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-[#4e6b51]" />
                  ) : (
                    <Clock className="w-4 h-4 text-accent" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{order.orderNumber}</p>
                    <span
                      className={cn(
                        "text-[10px] font-medium border px-1.5 py-0.5 rounded-full",
                        s.color,
                        s.bg,
                        s.border,
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {order.title}
                    {order.quantity > 1 ? ` × ${order.quantity}` : ""}
                  </p>
                  <p className="text-[11px] text-muted/60 mt-0.5">{order.createdAt}</p>
                </div>
                <p className="text-sm font-bold text-foreground shrink-0">
                  {order.finalInCents != null
                    ? `$${(order.finalInCents / 100).toFixed(0)}`
                    : "—"}
                </p>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
