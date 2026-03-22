"use client";

/**
 * ContactForm — inline "Get in touch" form for the public booking page.
 *
 * Reuses the /api/chat/fallback endpoint (name + email + question → Resend email to admin).
 * Self-contained with its own QueryClientProvider so no root provider is needed.
 */

import { useState, useCallback } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { useForm } from "@tanstack/react-form";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { LuCheck } from "react-icons/lu";
import { env } from "@/lib/env";

const qc = new QueryClient();

export function ContactForm() {
  return (
    <QueryClientProvider client={qc}>
      <Form />
    </QueryClientProvider>
  );
}

function Form() {
  const [turnstileToken, setTurnstileToken] = useState("");
  const handleTurnstileSuccess = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const {
    mutate: send,
    isPending,
    isSuccess,
  } = useMutation({
    mutationFn: async (data: {
      name: string;
      email: string;
      question: string;
      turnstileToken: string;
    }) => {
      const res = await fetch("/api/chat/fallback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to send");
    },
  });

  const form = useForm({
    defaultValues: { name: "", email: "", message: "" },
    onSubmit: ({ value }) =>
      send({ name: value.name, email: value.email, question: value.message, turnstileToken }),
  });

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#faf6f1] ring-2 ring-[#e8c4b8]">
          <LuCheck className="h-6 w-6 text-[#96604a]" />
        </div>
        <p className="font-semibold text-stone-900">Message sent!</p>
        <p className="text-sm text-stone-500">We&apos;ll get back to you within 24 hours. 🩷</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <form.Field
          name="name"
          validators={{ onChange: ({ value }) => (!value.trim() ? "Required" : undefined) }}
        >
          {(field) => (
            <input
              placeholder="Your name"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              className="w-full rounded-xl border border-[#e8c4b8] bg-white px-4 py-2.5 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-[#96604a] focus:ring-1 focus:ring-[#96604a]/20"
            />
          )}
        </form.Field>
        <form.Field
          name="email"
          validators={{
            onChange: ({ value }) =>
              !value.trim() || !value.includes("@") ? "Valid email required" : undefined,
          }}
        >
          {(field) => (
            <input
              type="email"
              placeholder="Your email"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              className="w-full rounded-xl border border-[#e8c4b8] bg-white px-4 py-2.5 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-[#96604a] focus:ring-1 focus:ring-[#96604a]/20"
            />
          )}
        </form.Field>
      </div>

      <form.Field
        name="message"
        validators={{ onChange: ({ value }) => (!value.trim() ? "Required" : undefined) }}
      >
        {(field) => (
          <textarea
            rows={3}
            placeholder="What's on your mind? (service questions, availability, anything!)"
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            className="w-full resize-none rounded-xl border border-[#e8c4b8] bg-white px-4 py-2.5 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-[#96604a] focus:ring-1 focus:ring-[#96604a]/20"
          />
        )}
      </form.Field>

      <Turnstile
        siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        onSuccess={handleTurnstileSuccess}
        onExpire={() => setTurnstileToken("")}
        options={{ theme: "light", size: "flexible" }}
      />

      <button
        type="submit"
        disabled={isPending || !turnstileToken}
        className="w-full rounded-xl bg-[#96604a] py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#7a4e3a] disabled:opacity-50 active:scale-[0.98]"
      >
        {isPending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
