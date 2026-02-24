import type { Metadata } from "next";
import { getAssistants, getAssistantAvailability } from "./actions";
import { AssistantsPage } from "./AssistantsPage";

export const metadata: Metadata = {
  title: "Assistants — T Creative Studio",
  description: "Manage your team roster and availability.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const [initialAssistants, initialAvailability] = await Promise.all([
    getAssistants(),
    getAssistantAvailability(),
  ]);

  return (
    <AssistantsPage
      initialAssistants={initialAssistants}
      initialAvailability={initialAvailability}
    />
  );
}
