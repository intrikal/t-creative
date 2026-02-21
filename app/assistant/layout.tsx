import type { ReactNode } from "react";
import { AssistantSidebar } from "./AssistantSidebar";

export default function AssistantLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AssistantSidebar />
      <main
        id="main-content"
        className="flex-1 flex flex-col min-w-0 overflow-y-auto lg:pl-56 pb-16 lg:pb-0"
      >
        {children}
      </main>
    </div>
  );
}
