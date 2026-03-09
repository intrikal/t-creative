"use server";

import { eq, desc, isNull, and } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export type InboxItem = {
  id: number;
  title: string;
  body: string | null;
  type: string;
  createdAt: string;
  readAt: string | null;
};

export type InboxSummary = {
  unreadCount: number;
  items: InboxItem[];
};

/** Returns recent internal notifications for the current user. */
export async function getInboxSummary(): Promise<InboxSummary> {
  const user = await getUser();

  const rows = await db
    .select({
      id: notifications.id,
      title: notifications.title,
      body: notifications.body,
      type: notifications.type,
      createdAt: notifications.createdAt,
      readAt: notifications.readAt,
    })
    .from(notifications)
    .where(and(eq(notifications.profileId, user.id), eq(notifications.channel, "internal")))
    .orderBy(desc(notifications.createdAt))
    .limit(20);

  const items: InboxItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    type: r.type,
    createdAt: r.createdAt.toISOString(),
    readAt: r.readAt?.toISOString() ?? null,
  }));

  const unreadCount = items.filter((i) => i.readAt === null).length;

  return { unreadCount, items };
}

/** Marks all unread internal notifications for the current user as read. */
export async function markAllInboxRead(): Promise<void> {
  const user = await getUser();

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.profileId, user.id),
        eq(notifications.channel, "internal"),
        isNull(notifications.readAt),
      ),
    );
}
