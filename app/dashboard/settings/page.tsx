import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { calendarUrl } from "@/lib/calendar-token";
import { getAssistantSettings } from "./assistant-settings-actions";
import { AssistantSettingsPage } from "./AssistantSettingsPage";
import { getClientSettings } from "./client-settings-actions";
import { ClientSettingsPage } from "./ClientSettingsPage";
import { getBusinessHours, getTimeOff, getLunchBreak } from "./hours-actions";
import { getServiceCategories } from "./service-categories-actions";
import {
  getBookingRules,
  getBusinessProfile,
  getFinancialConfig,
  getInventoryConfig,
  getRevenueGoals,
  getLoyaltyConfig,
  getNotificationPrefs,
  getPolicies,
  getReminders,
  getSiteContent,
  getSquareConnectionStatus,
} from "./settings-actions";
import { SettingsPage } from "./SettingsPage";

export const metadata: Metadata = {
  title: "Settings — T Creative Studio",
  description: "Business settings and configuration.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "client") {
    const data = await getClientSettings();
    return <ClientSettingsPage data={data} />;
  }

  if (user.profile?.role === "assistant") {
    const data = await getAssistantSettings();
    return <AssistantSettingsPage data={data} />;
  }

  const [
    initialHours,
    initialTimeOff,
    initialLunchBreak,
    initialBusiness,
    initialPolicies,
    initialLoyalty,
    initialNotifications,
    initialFinancial,
    initialRevenueGoals,
    initialBookingRules,
    initialReminders,
    initialSiteContent,
    initialInventory,
    initialCategories,
    squareStatus,
  ] = await Promise.all([
    getBusinessHours(),
    getTimeOff(),
    getLunchBreak(),
    getBusinessProfile(),
    getPolicies(),
    getLoyaltyConfig(),
    getNotificationPrefs(),
    getFinancialConfig(),
    getRevenueGoals(),
    getBookingRules(),
    getReminders(),
    getSiteContent(),
    getInventoryConfig(),
    getServiceCategories(),
    getSquareConnectionStatus(),
  ]);

  return (
    <SettingsPage
      initialHours={initialHours}
      initialTimeOff={initialTimeOff}
      initialLunchBreak={initialLunchBreak}
      initialBusiness={initialBusiness}
      initialPolicies={initialPolicies}
      initialLoyalty={initialLoyalty}
      initialNotifications={initialNotifications}
      initialFinancial={initialFinancial}
      initialRevenueGoals={initialRevenueGoals}
      initialBookingRules={initialBookingRules}
      initialReminders={initialReminders}
      initialSiteContent={initialSiteContent}
      initialInventory={initialInventory}
      initialCategories={initialCategories}
      squareStatus={squareStatus}
      calendarUrl={calendarUrl(user.id)}
    />
  );
}
