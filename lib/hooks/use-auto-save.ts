"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ActionResult = { success: true } | { success: false; error: string };

type AutoSaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

export function useAutoSave<T>({
  data,
  onSave,
  delay = 1500,
  enabled = true,
}: {
  data: T;
  onSave: (data: T) => Promise<ActionResult | void>;
  delay?: number;
  enabled?: boolean;
}) {
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const snapshotRef = useRef(JSON.stringify(data));
  const dataRef = useRef(data);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const savingRef = useRef(false);

  dataRef.current = data;

  const doSave = useCallback(async () => {
    if (savingRef.current) return;
    const current = JSON.stringify(dataRef.current);
    if (current === snapshotRef.current) return;

    savingRef.current = true;
    if (mountedRef.current) setStatus("saving");

    try {
      const result = await onSave(dataRef.current);
      if (result && "success" in result && !result.success) {
        throw new Error(result.error);
      }
      snapshotRef.current = JSON.stringify(dataRef.current);
      if (mountedRef.current) {
        setError(null);
        setStatus("saved");
        setTimeout(() => {
          if (mountedRef.current) setStatus("idle");
        }, 2000);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Save failed");
        setStatus("error");
      }
    } finally {
      savingRef.current = false;
    }
  }, [onSave]);

  // Dirty detection + debounce
  useEffect(() => {
    if (!enabled) return;
    const current = JSON.stringify(data);
    if (current === snapshotRef.current) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (status === "unsaved") setStatus("idle");
      return;
    }

    if (status !== "saving") setStatus("unsaved");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doSave, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, enabled, delay, doSave, status]);

  // Flush on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        // Fire-and-forget save if dirty
        const current = JSON.stringify(dataRef.current);
        if (current !== snapshotRef.current) {
          void doSave();
        }
      }
    };
  }, [doSave]);

  const dismissError = useCallback(() => {
    setError(null);
    setStatus("idle");
  }, []);

  const save = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await doSave();
  }, [doSave]);

  return { status, error, dismissError, save };
}
