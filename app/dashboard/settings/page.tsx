import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { calendarUrl } from "@/lib/calendar-token";

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
    { getAdminSettingsBundle, getSquareConnectionStatus },
    { SettingsPage },
  ] = await Promise.all([
    import("./hours-actions"),
    import("./service-categories-actions"),
    import("./settings-actions"),
    import("./SettingsPage"),
  ]);

  const [
    initialHours,
    initialTimeOff,
    initialLunchBreak,
    settingsBundle,
    initialCategories,
    squareStatus,
  ] = await Promise.all([
    getBusinessHours(),
    getTimeOff(),
    getLunchBreak(),
    getAdminSettingsBundle(),
    getServiceCategories(),
    getSquareConnectionStatus(),
  ]);

  return (
    <SettingsPage
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
    />
  );
}
