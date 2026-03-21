"use client";
import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Returns [flag, triggerFlag] where triggerFlag() sets flag to true,
 * then automatically resets it to false after `ms` milliseconds.
 * Cleans up the timeout on unmount to prevent memory leaks.
 */
export function useTimeoutFlag(ms = 2000): [boolean, () => void] {
  const [flag, setFlag] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const trigger = useCallback(() => {
    setFlag(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlag(false), ms);
  }, [ms]);

  return [flag, trigger];
}
