/**
 * Inngest function — Daily low stock alert.
 *
 * Checks all published products for stock levels at or below their
 * low_stock_threshold. If any are found, sends a notification email
 * to the admin with a list of items that need reordering.
 */
import { sql, lte, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { products, profiles } from "@/db/schema";
import { sendEmail, isResendConfigured } from "@/lib/resend";
import { inngest } from "../client";

export const lowStockAlert = inngest.createFunction(
  {
    id: "low-stock-alert",
    retries: 2,
    triggers: [{ event: "cron/low-stock-alert" }],
  },
  async ({ step }) => {
    const lowStockItems = await step.run("check-stock-levels", async () => {
      return db
        .select({
          id: products.id,
          title: products.title,
          sku: products.sku,
          stockCount: products.stockCount,
          lowStockThreshold: products.lowStockThreshold,
          reorderQuantity: products.reorderQuantity,
        })
        .from(products)
        .where(
          and(
            eq(products.isPublished, true),
            sql`${products.stockCount} <= ${products.lowStockThreshold}`,
          ),
        );
    });

    if (lowStockItems.length === 0) {
      return { skipped: true, reason: "No low stock items" };
    }

    await step.run("send-alert", async () => {
      if (!isResendConfigured()) return;

      // Find admin email
      const [admin] = await db
        .select({ email: profiles.email, firstName: profiles.firstName })
        .from(profiles)
        .where(eq(profiles.role, "admin"))
        .limit(1);

      if (!admin?.email) return;

      const itemList = lowStockItems
        .map(
          (p) =>
            `• ${p.title}${p.sku ? ` (${p.sku})` : ""}: ${p.stockCount} in stock (threshold: ${p.lowStockThreshold})`,
        )
        .join("\n");

      await sendEmail({
        to: admin.email,
        subject: `Low Stock Alert: ${lowStockItems.length} item${lowStockItems.length > 1 ? "s" : ""} need reordering`,
        react: (await import("react")).createElement(
          "div",
          null,
          (await import("react")).createElement("p", null, `Hi ${admin.firstName},`),
          (await import("react")).createElement(
            "p",
            null,
            `${lowStockItems.length} product${lowStockItems.length > 1 ? "s" : ""} ${lowStockItems.length > 1 ? "are" : "is"} at or below the low stock threshold:`,
          ),
          (await import("react")).createElement(
            "pre",
            { style: { fontFamily: "monospace", fontSize: 13 } },
            itemList,
          ),
          (await import("react")).createElement("p", null, "Please restock these items soon."),
        ),
        entityType: "low_stock_alert",
        localId: `low-stock-${new Date().toISOString().slice(0, 10)}`,
      });
    });

    return {
      alerted: lowStockItems.length,
      items: lowStockItems.map((p) => `${p.title}: ${p.stockCount}`),
    };
  },
);
