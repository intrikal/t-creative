"use server";

import { eq, desc, isNull, and, count } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getUser } from "@/lib/auth";

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

/** Marks a single notification as read (no-op if already read or not owned). */
export async function markOneRead(id: number): Promise<void> {
  const user = await getUser();

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.profileId, user.id),
        isNull(notifications.readAt),
      ),
    );
}

export type InboxPageResult = {
  items: InboxItem[];
  total: number;
  page: number;
  pageSize: number;
};

/** Returns a paginated, optionally type-filtered list of internal notifications. */
export async function getInboxPage(opts: {
  page?: number;
  pageSize?: number;
  type?: string;
}): Promise<InboxPageResult> {
  const user = await getUser();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const baseWhere =
    opts.type && opts.type !== "all"
      ? and(
          eq(notifications.profileId, user.id),
          eq(notifications.channel, "internal"),
          eq(notifications.type, opts.type as (typeof notifications.type)["_"]["data"]),
        )
      : and(eq(notifications.profileId, user.id), eq(notifications.channel, "internal"));

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: notifications.id,
        title: notifications.title,
        body: notifications.body,
        type: notifications.type,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt,
      })
      .from(notifications)
      .where(baseWhere)
      .orderBy(desc(notifications.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ value: count() }).from(notifications).where(baseWhere),
  ]);

  const items: InboxItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    type: r.type,
    createdAt: r.createdAt.toISOString(),
    readAt: r.readAt?.toISOString() ?? null,
  }));

  return { items, total: Number(total), page, pageSize };
}
