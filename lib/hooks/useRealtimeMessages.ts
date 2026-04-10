"use client";

/**
 * useRealtimeMessages — Subscribe to new messages via Supabase Realtime.
 *
 * Listens for INSERT events on the `messages` table. When a new row appears
 * from a different sender, calls `onNewMessage` with the raw payload so the
 * parent component can fetch full sender info and append to the message list.
 *
 * The channel is removed on unmount or when `enabled` flips to false.
 */
import { useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";

export interface RealtimeMessagePayload {
  id: number;
  thread_id: number;
  sender_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

interface UseRealtimeMessagesParams {
  /** ID of the thread currently being viewed (filters events). */
  threadId: number | null;
  /** Current user's ID — used to skip own messages (already optimistically rendered). */
  currentUserId: string;
  /** Callback fired when a new message from another user arrives in the active thread. */
  onNewMessage: (msg: RealtimeMessagePayload) => void;
  /** Skip subscription entirely when false. Defaults to true. */
  enabled?: boolean;
}

export function useRealtimeMessages({
  threadId,
  currentUserId,
  onNewMessage,
  enabled = true,
}: UseRealtimeMessagesParams) {
  // Stable ref so the subscription closure always sees the latest callback
  // without re-subscribing on every render.
  const callbackRef = useRef(onNewMessage);
  useEffect(() => {
    callbackRef.current = onNewMessage;
  }, [onNewMessage]);

  const threadIdRef = useRef(threadId);
  useEffect(() => {
    threadIdRef.current = threadId;
  }, [threadId]);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    const channel = supabase
      .channel("realtime-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as RealtimeMessagePayload;

          // Skip own messages — they're already optimistically rendered.
          if (newMsg.sender_id === currentUserId) return;

          // Only forward messages belonging to the currently viewed thread.
          if (newMsg.thread_id !== threadIdRef.current) return;

          callbackRef.current(newMsg);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, enabled]);
}
