"use client";

/**
 * useRealtimeThreadList — Subscribe to thread-list changes via Supabase Realtime.
 *
 * Listens for two event types:
 *  1. INSERT on `messages` — updates the thread's preview text, timestamp,
 *     and unread count without a full refetch.
 *  2. UPDATE on `threads` — syncs status, starred, archived, and closed flags.
 *
 * Calls the provided `setThreads` state setter directly so the parent
 * component's thread list stays in sync across all open tabs / users.
 *
 * The channel is removed on unmount or when `enabled` flips to false.
 */
import { useEffect, useRef } from "react";
import type { ThreadRow } from "@/app/dashboard/messages/actions";
import { createClient } from "@/utils/supabase/client";

interface RealtimeThreadPayload {
  id: number;
  thread_id: number;
  sender_id: string;
  body: string;
  created_at: string;
}

interface RealtimeThreadUpdatePayload {
  id: number;
  is_starred: boolean;
  is_archived: boolean;
  is_closed: boolean;
  status: string;
  last_message_at: string;
}

interface UseRealtimeThreadListParams {
  /** Current user's ID — used to skip unread bump for own messages. */
  currentUserId: string;
  /** Ref to the currently selected thread so unread count is not bumped for the viewed thread. */
  selectedThreadId: number | null;
  /** React state setter for the threads array. */
  setThreads: React.Dispatch<React.SetStateAction<ThreadRow[]>>;
  /** Subscribe to thread UPDATE events (status, starred, archived). Defaults to true. */
  subscribeToThreadUpdates?: boolean;
  /** Skip subscription entirely when false. Defaults to true. */
  enabled?: boolean;
}

export function useRealtimeThreadList({
  currentUserId,
  selectedThreadId,
  setThreads,
  subscribeToThreadUpdates = true,
  enabled = true,
}: UseRealtimeThreadListParams) {
  const selectedIdRef = useRef(selectedThreadId);
  useEffect(() => {
    selectedIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    let channel = supabase
      .channel("realtime-thread-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as RealtimeThreadPayload;

          // Skip own messages — the parent already updates optimistically on send.
          if (msg.sender_id === currentUserId) return;

          const currentSelected = selectedIdRef.current;

          setThreads((prev) =>
            prev.map((t) =>
              t.id === msg.thread_id
                ? {
                    ...t,
                    lastMessageBody: msg.body,
                    lastMessageAt: new Date(msg.created_at),
                    lastMessageSenderId: msg.sender_id,
                    unreadCount:
                      msg.thread_id === currentSelected ? t.unreadCount : t.unreadCount + 1,
                  }
                : t,
            ),
          );
        },
      );

    if (subscribeToThreadUpdates) {
      channel = channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "threads" },
        (payload) => {
          const updated = payload.new as RealtimeThreadUpdatePayload;
          setThreads((prev) =>
            prev.map((t) =>
              t.id === updated.id
                ? {
                    ...t,
                    isStarred: updated.is_starred,
                    isArchived: updated.is_archived,
                    isClosed: updated.is_closed,
                    status: updated.status,
                    lastMessageAt: new Date(updated.last_message_at),
                  }
                : t,
            ),
          );
        },
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, setThreads, subscribeToThreadUpdates, enabled]);
}
