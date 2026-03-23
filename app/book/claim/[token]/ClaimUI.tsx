"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import type { ClaimPageData } from "./actions";
import { claimWaitlistSlot } from "./actions";

interface Props {
  token: string;
  data: ClaimPageData;
  businessName?: string;
  email?: string;
}

export function ClaimUI({ token, data, businessName, email }: Props) {
  if (!data.valid) {
    return (
      <PageShell businessName={businessName}>
        <InvalidState reason={data.reason} email={email} />
      </PageShell>
    );
  }

  const slotDate = new Date(data.slotDate);
  const expiresAt = new Date(data.expiresAt);

  return (
    <PageShell businessName={businessName}>
      <ActiveClaim
        token={token}
        serviceName={data.serviceName}
        slotDate={slotDate}
        staffName={data.staffName}
        expiresAt={expiresAt}
      />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Active claim card                                                  */
/* ------------------------------------------------------------------ */

function ActiveClaim({
  token,
  serviceName,
  slotDate,
  staffName,
  expiresAt,
}: {
  token: string;
  serviceName: string;
  slotDate: Date;
  staffName: string | null;
  expiresAt: Date;
}) {
  const [isPending, startTransition] = useTransition();
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClaim() {
    setError(null);
    startTransition(async () => {
      const result = await claimWaitlistSlot(token);
      if (result.success) {
        setClaimed(true);
      } else {
        const messages: Record<string, string> = {
          expired:
            "Sorry, this offer has expired. Check your email — we may have notified the next person on the waitlist.",
          already_claimed: "This slot has already been claimed.",
          invalid_token: "This link is no longer valid.",
          unknown: "Something went wrong. Please try again or contact us.",
        };
        setError(messages[result.error] ?? messages.unknown);
      }
    });
  }

  if (claimed) {
    return (
      <div style={card}>
        <div style={iconCircle}>✓</div>
        <h1 style={heading}>You&apos;re booked!</h1>
        <p style={body}>
          Your appointment request for <strong>{serviceName}</strong> on{" "}
          <strong>{format(slotDate, "EEEE, MMMM d 'at' h:mm a")}</strong> has been submitted.
        </p>
        <p style={muted}>
          We&apos;ll send you a confirmation email once the booking is confirmed. See you soon!
        </p>
      </div>
    );
  }

  return (
    <div style={card}>
      <p style={labelStyle}>Your waitlist spot opened up</p>
      <h1 style={heading}>{serviceName}</h1>

      <div style={slotBlock}>
        <span style={slotDateStyle}>📅 {format(slotDate, "EEEE, MMMM d, yyyy")}</span>
        <span style={slotTimeStyle}>🕐 {format(slotDate, "h:mm a")}</span>
        {staffName && <span style={slotStaffStyle}>👤 with {staffName}</span>}
      </div>

      <p style={expiryStyle}>
        Offer expires <strong>{format(expiresAt, "MMM d 'at' h:mm a")}</strong>
      </p>

      {error && <p style={errorStyle}>{error}</p>}

      <button onClick={handleClaim} disabled={isPending} style={isPending ? btnDisabled : btn}>
        {isPending ? "Confirming…" : "Confirm My Booking"}
      </button>

      <p style={muted}>
        Not interested? Just close this page — your spot will be offered to the next person on the
        waitlist after the offer expires.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Invalid / expired state                                            */
/* ------------------------------------------------------------------ */

function InvalidState({
  reason,
  email: contactEmail,
}: {
  reason: "invalid_token" | "expired" | "already_claimed";
  email?: string;
}) {
  const messages = {
    expired: {
      title: "This offer has expired",
      body: "Your 24-hour window to claim this slot has passed. If you're still on the waitlist, you'll be notified the next time a spot opens up.",
    },
    already_claimed: {
      title: "Slot already claimed",
      body: "This slot has already been booked. If you're still waiting, you'll be notified when another spot opens.",
    },
    invalid_token: {
      title: "Link not found",
      body: "This booking link is no longer valid. It may have already been used, or the link may be incomplete.",
    },
  };

  const { title, body: bodyText } = messages[reason];

  return (
    <div style={card}>
      <h1 style={heading}>{title}</h1>
      <p style={body}>{bodyText}</p>
      <p style={muted}>
        Questions? Reply to your notification email or reach us at{" "}
        <a href={`mailto:${contactEmail ?? "hello@tcreativestudio.com"}`} style={link}>
          {contactEmail ?? "hello@tcreativestudio.com"}
        </a>
        .
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page shell                                                         */
/* ------------------------------------------------------------------ */

function PageShell({
  children,
  businessName,
}: {
  children: React.ReactNode;
  businessName?: string;
}) {
  return (
    <div style={shell}>
      <div style={inner}>
        <p style={brand}>{businessName ?? "T Creative Studio"}</p>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const shell: React.CSSProperties = {
  minHeight: "100vh",
  backgroundColor: "#fafafa",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 16px",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const inner: React.CSSProperties = { width: "100%", maxWidth: "440px" };

const brand: React.CSSProperties = {
  textAlign: "center",
  fontSize: "13px",
  fontWeight: "600",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#888",
  marginBottom: "24px",
};

const card: React.CSSProperties = {
  backgroundColor: "#fff",
  borderRadius: "12px",
  border: "1px solid #e5e5e5",
  padding: "32px 28px",
};

const iconCircle: React.CSSProperties = {
  width: "48px",
  height: "48px",
  borderRadius: "50%",
  backgroundColor: "#1a1a1a",
  color: "#fff",
  fontSize: "22px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "20px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: "600",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#888",
  margin: "0 0 8px",
};

const heading: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "700",
  color: "#1a1a1a",
  margin: "0 0 20px",
  lineHeight: "1.2",
};

const body: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "1.6",
  color: "#333",
  margin: "0 0 16px",
};

const slotBlock: React.CSSProperties = {
  backgroundColor: "#f5f5f5",
  borderRadius: "8px",
  padding: "16px",
  marginBottom: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const slotDateStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: "600",
  color: "#1a1a1a",
};
const slotTimeStyle: React.CSSProperties = { fontSize: "15px", color: "#333" };
const slotStaffStyle: React.CSSProperties = { fontSize: "14px", color: "#555" };

const expiryStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#888",
  margin: "0 0 20px",
};

const btn: React.CSSProperties = {
  display: "block",
  width: "100%",
  backgroundColor: "#1a1a1a",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  padding: "14px",
  fontSize: "15px",
  fontWeight: "600",
  cursor: "pointer",
  marginBottom: "16px",
};

const btnDisabled: React.CSSProperties = { ...btn, opacity: 0.6, cursor: "not-allowed" };

const errorStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#c0392b",
  backgroundColor: "#fdf0ee",
  borderRadius: "6px",
  padding: "10px 12px",
  margin: "0 0 16px",
};

const muted: React.CSSProperties = {
  fontSize: "13px",
  color: "#888",
  lineHeight: "1.5",
  margin: "0",
};

const link: React.CSSProperties = { color: "#1a1a1a" };
