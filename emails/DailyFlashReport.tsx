import * as React from "react";
import { Section, Text, Hr } from "@react-email/components";
import { Layout } from "./components/Layout";

export type DailyFlashReportProps = {
  date: string;
  yesterdayRevenue: number;
  todayAppointments: number;
  todayAppointmentList: { time: string; client: string; service: string }[];
  overnightCancellations: { client: string; service: string; wasScheduledFor: string }[];
  newInquiries: number;
  waitlistChanges: { added: number; claimed: number; expired: number };
  outstandingInvoices: { count: number; totalDue: number };
};

export function DailyFlashReport({
  date,
  yesterdayRevenue,
  todayAppointments,
  todayAppointmentList,
  overnightCancellations,
  newInquiries,
  waitlistChanges,
  outstandingInvoices,
}: DailyFlashReportProps) {
  return (
    <Layout preview={`Daily Flash — ${date}`}>
      <Section style={content}>
        <Text style={heading}>Daily Flash Report</Text>
        <Text style={subheading}>{date}</Text>

        {/* Quick Stats */}
        <Section style={statsRow}>
          <Text style={statBlock}>
            <span style={statValue}>${yesterdayRevenue.toLocaleString()}</span>
            {"\n"}
            <span style={statLabel}>Yesterday&apos;s Revenue</span>
          </Text>
          <Text style={statBlock}>
            <span style={statValue}>{todayAppointments}</span>
            {"\n"}
            <span style={statLabel}>Today&apos;s Appointments</span>
          </Text>
          <Text style={statBlock}>
            <span style={statValue}>{newInquiries}</span>
            {"\n"}
            <span style={statLabel}>New Inquiries</span>
          </Text>
        </Section>

        {/* Today's Schedule */}
        {todayAppointmentList.length > 0 && (
          <>
            <Hr style={divider} />
            <Text style={sectionTitle}>Today&apos;s Schedule</Text>
            {todayAppointmentList.map((appt, i) => (
              <Text key={i} style={listItem}>
                <span style={listTime}>{appt.time}</span> — {appt.client} ({appt.service})
              </Text>
            ))}
          </>
        )}

        {/* Overnight Cancellations */}
        {overnightCancellations.length > 0 && (
          <>
            <Hr style={divider} />
            <Text style={sectionTitleAlert}>
              Cancellations Overnight ({overnightCancellations.length})
            </Text>
            {overnightCancellations.map((c, i) => (
              <Text key={i} style={listItem}>
                {c.client} — {c.service} (was {c.wasScheduledFor})
              </Text>
            ))}
          </>
        )}

        {/* Waitlist */}
        {(waitlistChanges.added > 0 ||
          waitlistChanges.claimed > 0 ||
          waitlistChanges.expired > 0) && (
          <>
            <Hr style={divider} />
            <Text style={sectionTitle}>Waitlist Activity</Text>
            <Text style={listItem}>
              {waitlistChanges.added > 0 && `${waitlistChanges.added} added · `}
              {waitlistChanges.claimed > 0 && `${waitlistChanges.claimed} claimed · `}
              {waitlistChanges.expired > 0 && `${waitlistChanges.expired} expired`}
            </Text>
          </>
        )}

        {/* Outstanding Invoices */}
        {outstandingInvoices.count > 0 && (
          <>
            <Hr style={divider} />
            <Text style={sectionTitle}>Outstanding Invoices</Text>
            <Text style={listItem}>
              {outstandingInvoices.count} unpaid — ${outstandingInvoices.totalDue.toLocaleString()}{" "}
              total due
            </Text>
          </>
        )}
      </Section>
    </Layout>
  );
}

const content: React.CSSProperties = {
  padding: "0 40px",
};

const heading: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: "700",
  color: "#1a1a1a",
  margin: "0 0 4px",
};

const subheading: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
  margin: "0 0 24px",
};

const statsRow: React.CSSProperties = {
  display: "flex",
  gap: "16px",
};

const statBlock: React.CSSProperties = {
  fontSize: "13px",
  color: "#666",
  margin: "0 24px 0 0",
  lineHeight: "1.6",
  whiteSpace: "pre-line",
};

const statValue: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: "700",
  color: "#1a1a1a",
};

const statLabel: React.CSSProperties = {
  fontSize: "11px",
  color: "#999",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const divider: React.CSSProperties = {
  borderColor: "#eee",
  margin: "20px 0",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: "600",
  color: "#1a1a1a",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  margin: "0 0 8px",
};

const sectionTitleAlert: React.CSSProperties = {
  ...sectionTitle,
  color: "#d4573b",
};

const listItem: React.CSSProperties = {
  fontSize: "14px",
  color: "#333",
  margin: "0 0 6px",
  lineHeight: "1.5",
};

const listTime: React.CSSProperties = {
  fontWeight: "600",
  color: "#1a1a1a",
};
