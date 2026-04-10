import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { calendarUrl } from "@/lib/calendar-token";
import { redis } from "@/lib/redis";
import type { WebhookHealth } from "./components/IntegrationsTab";

export const metadata: Metadata = {
  title: "Settings — T Creative Studio",
  description: "Business settings and configuration.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "client") {
    const [{ getClientSettings }, { ClientSettingsPage }] = await Promise.all([
      import("./client-settings-actions"),
      import("./ClientSettingsPage"),
    ]);
    const data = await getClientSettings();
    return <ClientSettingsPage data={data} />;
  }

  if (user.profile?.role === "assistant") {
    const [{ getAssistantSettings }, { AssistantSettingsPage }] = await Promise.all([
      import("./assistant-settings-actions"),
      import("./AssistantSettingsPage"),
    ]);
    const data = await getAssistantSettings();
    return <AssistantSettingsPage data={data} />;
  }

  const [
    { getBusinessHours, getTimeOff, getLunchBreak },
    { getServiceCategories },
    { getAdminSettingsBundle, getSquareConnectionStatus, getCcpaDeletionLog },
    { SettingsPage },
    { getLegalDoc, seedLegalDefaults },
    { getWebhookEvents },
    { getAllLocations },
  ] = await Promise.all([
    import("./hours-actions"),
    import("./service-categories-actions"),
    import("./settings-actions"),
    import("./SettingsPage"),
    import("../legal/actions"),
    import("./webhook-actions"),
    import("../location-actions"),
  ]);

  const seeded = seedLegalDefaults();

  const [
    initialHours,
    initialTimeOff,
    initialLunchBreak,
    settingsBundle,
    initialCategories,
    squareStatus,
    initialPrivacy,
    initialTerms,
    initialDeletionLog,
    lastSuccess,
    failures,
    initialWebhookEvents,
    initialLocations,
  ] = await Promise.all([
    getBusinessHours(),
    getTimeOff(),
    getLunchBreak(),
    getAdminSettingsBundle(),
    getServiceCategories(),
    getSquareConnectionStatus(),
    seeded.then(() => getLegalDoc("privacy_policy")),
    seeded.then(() => getLegalDoc("terms_of_service")),
    getCcpaDeletionLog(),
    redis.get<string>("webhook:last_success"),
    redis.get<number>("webhook:sig_failures"),
    getWebhookEvents(),
    getAllLocations(),
  ]);
  const failureCount = Number(failures ?? 0);
  const webhookHealth: WebhookHealth = {
    lastSuccessfulWebhook: lastSuccess ?? null,
    failureCountLastHour: failureCount,
    status: failureCount >= 5 ? "failing" : failureCount > 0 ? "degraded" : "healthy",
  };

  return (
    <SettingsPage
      initialLocations={initialLocations}
      initialHours={initialHours}
      initialTimeOff={initialTimeOff}
      initialLunchBreak={initialLunchBreak}
      initialBusiness={settingsBundle.businessProfile}
      initialPolicies={settingsBundle.policies}
      initialLoyalty={settingsBundle.loyalty}
      initialNotifications={settingsBundle.notifications}
      initialFinancial={settingsBundle.financial}
      initialRevenueGoals={settingsBundle.revenueGoals}
      initialBookingRules={settingsBundle.bookingRules}
      initialReminders={settingsBundle.reminders}
      initialSiteContent={settingsBundle.siteContent}
      initialInventory={settingsBundle.inventory}
      initialCategories={initialCategories}
      squareStatus={squareStatus}
      calendarUrl={calendarUrl(user.id)}
      webhookHealth={webhookHealth}
      initialPrivacy={initialPrivacy}
      initialTerms={initialTerms}
      initialDeletionLog={initialDeletionLog}
      initialWebhookEvents={initialWebhookEvents}
    />
  );
}
