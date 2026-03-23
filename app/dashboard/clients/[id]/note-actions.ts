/**
 * note-actions.ts — Server actions for client notes (communication history).
 *
 * CRUD operations for the client_notes table + search/filter.
 * All mutations are audit-logged and require admin/staff auth.
 *
 * @see {@link ./components/NotesTab.tsx} — UI consumer
 * @see {@link db/schema/client-notes.ts} — table definition
 */
"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { and, eq, desc, gte, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db";
import { clientNotes, profiles } from "@/db/schema";
import { logAction } from "@/lib/audit";
import { requireStaff } from "@/lib/auth";
import { trackEvent } from "@/lib/posthog";
import type { ActionResult } from "@/lib/types/action-result";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ClientNoteRow = {
  id: number;
  type: string;
  content: string;
  isPinned: boolean;
  authorName: string;
  authorId: string;
  createdAt: Date;
};

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

export async function getClientNotes(
  profileId: string,
  opts?: {
    type?: string;
    startDate?: string;
    endDate?: string;
    authorId?: string;
  },
): Promise<ClientNoteRow[]> {
  try {
    await requireStaff();

    const authorProfile = alias(profiles, "author");

    const conditions = [eq(clientNotes.profileId, profileId)];

    if (opts?.type && opts.type !== "all") {
      conditions.push(
        eq(clientNotes.type, opts.type as "note" | "call" | "email" | "sms" | "in_person"),
      );
    }
    if (opts?.startDate) {
      conditions.push(gte(clientNotes.createdAt, new Date(opts.startDate)));
    }
    if (opts?.endDate) {
      const end = new Date(opts.endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(clientNotes.createdAt, end));
    }
    if (opts?.authorId) {
      conditions.push(eq(clientNotes.authorId, opts.authorId));
    }

    const rows = await db
      .select({
        id: clientNotes.id,
        type: clientNotes.type,
        content: clientNotes.content,
        isPinned: clientNotes.isPinned,
        authorId: clientNotes.authorId,
        authorFirstName: authorProfile.firstName,
        authorLastName: authorProfile.lastName,
        createdAt: clientNotes.createdAt,
      })
      .from(clientNotes)
      .leftJoin(authorProfile, eq(clientNotes.authorId, authorProfile.id))
      .where(and(...conditions))
      .orderBy(desc(clientNotes.createdAt));

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      content: r.content,
      isPinned: r.isPinned,
      authorId: r.authorId,
      authorName: [r.authorFirstName, r.authorLastName].filter(Boolean).join(" ") || "System",
      createdAt: r.createdAt,
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/** Fetch only pinned notes for the profile header banner. */
export async function getPinnedNotes(profileId: string): Promise<ClientNoteRow[]> {
  try {
    await requireStaff();

    const authorProfile = alias(profiles, "author");

    const rows = await db
      .select({
        id: clientNotes.id,
        type: clientNotes.type,
        content: clientNotes.content,
        isPinned: clientNotes.isPinned,
        authorId: clientNotes.authorId,
        authorFirstName: authorProfile.firstName,
        authorLastName: authorProfile.lastName,
        createdAt: clientNotes.createdAt,
      })
      .from(clientNotes)
      .leftJoin(authorProfile, eq(clientNotes.authorId, authorProfile.id))
      .where(and(eq(clientNotes.profileId, profileId), eq(clientNotes.isPinned, true)))
      .orderBy(desc(clientNotes.createdAt));

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      content: r.content,
      isPinned: r.isPinned,
      authorId: r.authorId,
      authorName: [r.authorFirstName, r.authorLastName].filter(Boolean).join(" ") || "System",
      createdAt: r.createdAt,
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

const createNoteSchema = z.object({
  profileId: z.string().uuid(),
  type: z.enum(["note", "call", "email", "sms", "in_person"]),
  content: z.string().min(1, "Note content is required"),
  isPinned: z.boolean().default(false),
});

export async function createClientNote(data: {
  profileId: string;
  type: "note" | "call" | "email" | "sms" | "in_person";
  content: string;
  isPinned?: boolean;
}): Promise<ActionResult<{ id: number }>> {
  try {
    const parsed = createNoteSchema.parse(data);
    const user = await requireStaff();

    const [note] = await db
      .insert(clientNotes)
      .values({
        profileId: parsed.profileId,
        authorId: user.id,
        type: parsed.type,
        content: parsed.content,
        isPinned: parsed.isPinned ?? false,
      })
      .returning({ id: clientNotes.id });

    trackEvent(user.id, "client_note_created", {
      profileId: parsed.profileId,
      type: parsed.type,
      isPinned: parsed.isPinned,
    });

    await logAction({
      actorId: user.id,
      action: "create",
      entityType: "client_note",
      entityId: String(note.id),
      description: `Added ${parsed.type} note for client`,
      metadata: { profileId: parsed.profileId, type: parsed.type, isPinned: parsed.isPinned },
    });

    revalidatePath(`/dashboard/clients/${parsed.profileId}`);
    return { success: true, data: { id: note.id } };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to create note";
    return { success: false, error: message };
  }
}

export async function updateClientNote(
  noteId: number,
  data: { content?: string; isPinned?: boolean },
): Promise<ActionResult<void>> {
  try {
    z.number().int().positive().parse(noteId);
    const user = await requireStaff();

    const updates: Record<string, unknown> = {};
    if (data.content !== undefined) updates.content = data.content;
    if (data.isPinned !== undefined) updates.isPinned = data.isPinned;

    if (Object.keys(updates).length === 0) {
      return { success: true, data: undefined };
    }

    await db.update(clientNotes).set(updates).where(eq(clientNotes.id, noteId));

    await logAction({
      actorId: user.id,
      action: "update",
      entityType: "client_note",
      entityId: String(noteId),
      description:
        data.isPinned !== undefined
          ? `Note ${data.isPinned ? "pinned" : "unpinned"}`
          : "Note updated",
    });

    revalidatePath("/dashboard/clients");
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to update note";
    return { success: false, error: message };
  }
}

export async function deleteClientNote(noteId: number): Promise<ActionResult<void>> {
  try {
    z.number().int().positive().parse(noteId);
    const user = await requireStaff();

    await db.delete(clientNotes).where(eq(clientNotes.id, noteId));

    await logAction({
      actorId: user.id,
      action: "delete",
      entityType: "client_note",
      entityId: String(noteId),
      description: "Client note deleted",
    });

    revalidatePath("/dashboard/clients");
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to delete note";
    return { success: false, error: message };
  }
}

/* ------------------------------------------------------------------ */
/*  Auto-logging helper (called from sendEmail/sendSms)                */
/* ------------------------------------------------------------------ */

/**
 * Auto-create a client_note when the system sends an email or SMS.
 * Called from `lib/resend.ts` and `lib/twilio.ts` — non-fatal.
 */
export async function autoLogCommunication(params: {
  profileId: string;
  type: "email" | "sms";
  content: string;
  authorId: string;
}): Promise<void> {
  try {
    await db.insert(clientNotes).values({
      profileId: params.profileId,
      authorId: params.authorId,
      type: params.type,
      content: params.content,
      isPinned: false,
    });
  } catch {
    // Non-fatal — don't break email/SMS sending if note logging fails
  }
}
