"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, X } from "lucide-react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** Convert a URL-safe base64 VAPID key to a Uint8Array for the push API. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export function PushNotificationPrompt() {
  const [show, setShow] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Don't show if push isn't supported, VAPID key is missing, or already dismissed
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID_PUBLIC_KEY) return;
    if (localStorage.getItem("push-prompt-dismissed")) return;

    // Check if already subscribed
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) {
          setSubscribed(true);
        } else if (Notification.permission !== "denied") {
          setShow(true);
        }
      });
    });
  }, []);

  const subscribe = useCallback(async () => {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setShow(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });

      // Send subscription to the server
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (response.ok) {
        setSubscribed(true);
        setShow(false);
      }
    } catch {
      // Permission denied or subscription failed
    } finally {
      setLoading(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    setShow(false);
    localStorage.setItem("push-prompt-dismissed", "1");
  }, []);

  if (!show || subscribed) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-accent/20 bg-accent/[0.04]">
      <Bell className="w-4 h-4 text-accent shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-foreground">
          Get appointment reminders
        </span>
        <span className="text-xs text-muted ml-2 hidden sm:inline">
          We&apos;ll notify you before upcoming appointments so you never miss one.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={subscribe}
          disabled={loading}
          className="text-xs font-semibold text-white bg-accent hover:bg-accent/90 transition-colors rounded-lg px-3 py-1.5 disabled:opacity-50"
        >
          {loading ? "Enabling…" : "Enable"}
        </button>
        <button
          onClick={dismiss}
          className="text-muted hover:text-foreground transition-colors p-1"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
