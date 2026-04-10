/**
 * lib/hooks/useRealtimeMessages.test.ts
 *
 * Tests for the useRealtimeMessages hook.
 *
 * Strategy:
 * - Mock @/utils/supabase/client so createClient returns a fake Supabase
 *   instance with a chainable channel builder.
 * - Use renderHook to mount the hook and verify it subscribes to the correct
 *   table, fires the callback on INSERT, and cleans up the channel on unmount.
 */
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRealtimeMessages } from "./useRealtimeMessages";

/* ── Supabase mock ──────────────────────────────────────────────────────── */

type PostgresCallback = (payload: { new: Record<string, unknown> }) => void;

const mockRemoveChannel = vi.fn();
const mockSubscribe = vi.fn().mockReturnThis();

/** Captured INSERT callback so tests can simulate a Realtime event. */
let capturedCallback: PostgresCallback | null = null;

/** The channel object returned by supabase.channel(). */
const mockChannel = {
  on: vi.fn((_type: string, _filter: Record<string, string>, cb: PostgresCallback) => {
    capturedCallback = cb;
    return mockChannel;
  }),
  subscribe: mockSubscribe,
};

const mockCreateClient = vi.fn(() => ({
  channel: vi.fn(() => mockChannel),
  removeChannel: mockRemoveChannel,
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

/* ── Tests ──────────────────────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  capturedCallback = null;
});

describe("useRealtimeMessages", () => {
  it("subscribes to the messages table on mount", () => {
    const onNewMessage = vi.fn();

    renderHook(() =>
      useRealtimeMessages({
        threadId: 42,
        currentUserId: "user-1",
        onNewMessage,
      }),
    );

    expect(mockChannel.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      expect.any(Function),
    );
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it("calls onNewMessage when an INSERT arrives for the active thread", () => {
    const onNewMessage = vi.fn();

    renderHook(() =>
      useRealtimeMessages({
        threadId: 42,
        currentUserId: "user-1",
        onNewMessage,
      }),
    );

    expect(capturedCallback).not.toBeNull();

    act(() => {
      capturedCallback!({
        new: {
          id: 100,
          thread_id: 42,
          sender_id: "user-2",
          body: "Hello!",
          is_read: false,
          created_at: "2026-04-09T12:00:00Z",
        },
      });
    });

    expect(onNewMessage).toHaveBeenCalledOnce();
    expect(onNewMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 100, thread_id: 42, sender_id: "user-2" }),
    );
  });

  it("ignores messages from the current user (already optimistically rendered)", () => {
    const onNewMessage = vi.fn();

    renderHook(() =>
      useRealtimeMessages({
        threadId: 42,
        currentUserId: "user-1",
        onNewMessage,
      }),
    );

    act(() => {
      capturedCallback!({
        new: {
          id: 101,
          thread_id: 42,
          sender_id: "user-1",
          body: "My own message",
          is_read: false,
          created_at: "2026-04-09T12:00:00Z",
        },
      });
    });

    expect(onNewMessage).not.toHaveBeenCalled();
  });

  it("ignores messages for a different thread", () => {
    const onNewMessage = vi.fn();

    renderHook(() =>
      useRealtimeMessages({
        threadId: 42,
        currentUserId: "user-1",
        onNewMessage,
      }),
    );

    act(() => {
      capturedCallback!({
        new: {
          id: 102,
          thread_id: 99,
          sender_id: "user-2",
          body: "Wrong thread",
          is_read: false,
          created_at: "2026-04-09T12:00:00Z",
        },
      });
    });

    expect(onNewMessage).not.toHaveBeenCalled();
  });

  it("removes the channel on unmount", () => {
    const onNewMessage = vi.fn();

    const { unmount } = renderHook(() =>
      useRealtimeMessages({
        threadId: 42,
        currentUserId: "user-1",
        onNewMessage,
      }),
    );

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
  });

  it("does not subscribe when enabled is false", () => {
    const onNewMessage = vi.fn();

    renderHook(() =>
      useRealtimeMessages({
        threadId: 42,
        currentUserId: "user-1",
        onNewMessage,
        enabled: false,
      }),
    );

    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockSubscribe).not.toHaveBeenCalled();
  });
});
