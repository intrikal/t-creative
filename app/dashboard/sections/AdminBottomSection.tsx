import Link from "next/link";
import { Users, Clock, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getAdminRecentClientsAndTeam } from "../admin-home-queries";
import { EmptyState } from "../components/AdminEmptyState";
import { ClientRow } from "../components/AdminListRows";

export async function AdminBottomSection() {
  const { recentClients, teamToday } = await getAdminRecentClientsAndTeam();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
      <Card className="xl:col-span-2 gap-0 py-0">
        <CardHeader className="pb-0 pt-4 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Team Today</CardTitle>
            <Link href="/dashboard/team" className="text-xs text-accent hover:underline flex items-center gap-0.5">
              Full roster <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4 pt-2">
          {teamToday.length > 0 ? (
            teamToday.map((s) => (
              <div key={s.name} className="flex items-center gap-2.5 py-2.5 border-b border-border/50 last:border-0">
                <Avatar size="sm">
                  <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                    {s.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium", s.status === "on_leave" ? "text-muted" : "text-foreground")}>
                    {s.name}
                  </p>
                  <p className="text-xs text-muted mt-0.5">{s.role}</p>
                </div>
                {s.status === "on_leave" ? (
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full border bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20 shrink-0">
                    On Leave
                  </span>
                ) : (
                  <span className="text-[10px] text-muted shrink-0 flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    {s.hours}
                  </span>
                )}
              </div>
            ))
          ) : (
            <EmptyState
              icon={Users}
              message="No shifts scheduled today"
              detail="Team members will appear here when they have shifts."
              actionLabel="Manage roster"
              actionHref="/dashboard/team"
            />
          )}
        </CardContent>
      </Card>

      <Card className="xl:col-span-3 gap-0 py-0">
        <CardHeader className="pb-0 pt-4 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Recent Clients</CardTitle>
            <Link href="/dashboard/clients" className="text-xs text-accent hover:underline flex items-center gap-0.5">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4 pt-2">
          {recentClients.length > 0 ? (
            recentClients.map((client) => <ClientRow key={client.id} client={client} />)
          ) : (
            <EmptyState
              icon={Users}
              message="No recent clients"
              detail="New clients will appear here as they sign up or book."
              actionLabel="View all clients"
              actionHref="/dashboard/clients"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
