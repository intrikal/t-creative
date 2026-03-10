import type { Metadata } from "next";
import {
  getAssistants,
  getAssistantAvailability,
  getCommissionsData,
  getPayrollData,
} from "./actions";
import { AssistantsPage } from "./AssistantsPage";

export const metadata: Metadata = {
  title: "Assistants — T Creative Studio",
  description: "Manage your team roster and availability.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const [initialAssistants, initialAvailability, commissionsData, payroll] = await Promise.all([
    getAssistants(),
    getAssistantAvailability(),
    getCommissionsData(),
    getPayrollData(),
  ]);

  return (
    <AssistantsPage
      initialAssistants={initialAssistants}
      initialAvailability={initialAvailability}
      commissionsData={commissionsData}
      payrollRows={payroll.rows}
      payrollSummary={payroll.summary}
    />
  );
}
