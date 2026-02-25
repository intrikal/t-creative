import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getAssistantSettings } from "./assistant-settings-actions";
import { AssistantSettingsPage } from "./AssistantSettingsPage";
import { getClientSettings } from "./client-settings-actions";
import { ClientSettingsPage } from "./ClientSettingsPage";
import { getBusinessHours, getTimeOff, getLunchBreak } from "./hours-actions";
import {
  getBusinessProfile,
  getPolicies,
  getLoyaltyConfig,
  getNotificationPrefs,
  getFinancialConfig,
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
  ] = await Promise.all([
    getBusinessHours(),
    getTimeOff(),
    getLunchBreak(),
    getBusinessProfile(),
    getPolicies(),
    getLoyaltyConfig(),
    getNotificationPrefs(),
    getFinancialConfig(),
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
    />
  );
}
