"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { serviceCategories } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export type ServiceCategoryRow = {
  id: number;
  name: string;
  slug: string;
  displayOrder: number;
  isActive: boolean;
};

export async function getServiceCategories(): Promise<ServiceCategoryRow[]> {
  try {
    await requireAdmin();
    const rows = await db
      .select()
      .from(serviceCategories)
      .orderBy(asc(serviceCategories.displayOrder));
    return rows;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/),
  displayOrder: z.number().int().nonnegative(),
  isActive: z.boolean(),
});

export async function saveServiceCategory(
  data: Omit<ServiceCategoryRow, "id"> & { id?: number },
): Promise<void> {
  try {
    categorySchema.parse(data);
    await requireAdmin();

    if (data.id) {
      await db
        .update(serviceCategories)
        .set({
          name: data.name,
          slug: data.slug,
          displayOrder: data.displayOrder,
          isActive: data.isActive,
        })
        .where(eq(serviceCategories.id, data.id));
    } else {
      await db.insert(serviceCategories).values({
        name: data.name,
        slug: data.slug,
        displayOrder: data.displayOrder,
        isActive: data.isActive,
      });
    }

    revalidatePath("/dashboard/settings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function deleteServiceCategory(id: number): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    await requireAdmin();
    await db.delete(serviceCategories).where(eq(serviceCategories.id, id));
    revalidatePath("/dashboard/settings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
