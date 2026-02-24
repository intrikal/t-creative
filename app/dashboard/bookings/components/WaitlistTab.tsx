"use client";

import { Plus, Phone, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { categoryDot, type ServiceCategory } from "../BookingsPage";

type WaitlistStatus = "waiting" | "contacted" | "booked" | "removed";

export interface WaitlistEntry {
  id: number;
  client: string;
  clientInitials: string;
  phone: string;
  service: string;
  category: ServiceCategory;
  datePreference: string;
  addedDate: string;
  status: WaitlistStatus;
  notes?: string;
}

export const INITIAL_WAITLIST: WaitlistEntry[] = [
  {
    id: 1,
    client: "Naomi Blake",
    clientInitials: "NB",
    phone: "(404) 555-0201",
    service: "Volume Lashes — Full Set",
    category: "lash",
    datePreference: "ASAP",
    addedDate: "Feb 15",
    status: "waiting",
  },
  {
    id: 2,
    client: "Tyler Nguyen",
    clientInitials: "TN",
    phone: "(404) 555-0202",
    service: "Permanent Jewelry Weld",
    category: "jewelry",
    datePreference: "Weekends preferred",
    addedDate: "Feb 17",
    status: "contacted",
    notes: "Texted Feb 18 — awaiting reply",
  },
  {
    id: 3,
    client: "Zara Ahmed",
    clientInitials: "ZA",
    phone: "(404) 555-0203",
    service: "Mega Volume Lashes",
    category: "lash",
    datePreference: "Feb 25–28",
    addedDate: "Feb 18",
    status: "waiting",
  },
  {
    id: 4,
    client: "Deja Morris",
    clientInitials: "DM",
    phone: "(404) 555-0204",
    service: "Crochet Install",
    category: "crochet",
    datePreference: "Any Saturday",
    addedDate: "Feb 19",
    status: "booked",
    notes: "Booked for Mar 1 with Brianna",
  },
  {
    id: 5,
    client: "Renee Jackson",
    clientInitials: "RJ",
    phone: "(404) 555-0205",
    service: "Business Consulting",
    category: "consulting",
    datePreference: "Any Thursday",
    addedDate: "Feb 20",
    status: "waiting",
  },
];

function waitlistStatusConfig(status: WaitlistStatus) {
  switch (status) {
    case "waiting":
      return { label: "Waiting", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
    case "contacted":
      return {
        label: "Contacted",
        className: "bg-foreground/8 text-foreground border-foreground/15",
      };
    case "booked":
      return { label: "Booked", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "removed":
      return { label: "Removed", className: "bg-foreground/5 text-muted border-foreground/10" };
  }
}

export function WaitlistTab({
  waitlist,
  onBook,
  onRemove,
}: {
  waitlist: WaitlistEntry[];
  onBook: () => void;
  onRemove: (id: number) => void;
}) {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-0 pt-4 px-4 md:px-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            Waitlist
            <span className="ml-2 text-xs text-muted font-normal">
              {waitlist.filter((w) => w.status !== "removed").length} clients
            </span>
          </p>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add to Waitlist
          </button>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5">
                  Client
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden md:table-cell">
                  Service
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                  Date Pref.
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden lg:table-cell">
                  Added
                </th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                  Status
                </th>
                <th className="px-4 md:px-5 pb-2.5" />
              </tr>
            </thead>
            <tbody>
              {waitlist.map((w) => {
                const wStatus = waitlistStatusConfig(w.status);
                return (
                  <tr
                    key={w.id}
                    className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors group"
                  >
                    <td className="px-4 md:px-5 py-3 align-middle">
                      <div className="flex items-center gap-2.5">
                        <Avatar size="sm">
                          <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                            {w.clientInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-foreground">{w.client}</p>
                          <p className="text-[10px] text-muted flex items-center gap-0.5 mt-0.5">
                            <Phone className="w-2.5 h-2.5" />
                            {w.phone}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell align-middle">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            categoryDot(w.category),
                          )}
                        />
                        <span className="text-xs text-muted">{w.service}</span>
                      </div>
                      {w.notes && (
                        <p className="text-[10px] text-muted/60 mt-0.5 pl-3">{w.notes}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <span className="text-xs text-foreground">{w.datePreference}</span>
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell align-middle">
                      <span className="text-xs text-muted">{w.addedDate}</span>
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <Badge className={cn("border text-[10px] px-1.5 py-0.5", wStatus.className)}>
                        {wStatus.label}
                      </Badge>
                    </td>
                    <td className="px-4 md:px-5 py-3 align-middle">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <button
                          onClick={onBook}
                          className="text-[11px] text-accent hover:underline font-medium"
                        >
                          Book
                        </button>
                        {w.status !== "removed" && (
                          <button
                            onClick={() => onRemove(w.id)}
                            className="p-1.5 rounded-md hover:bg-foreground/8 text-muted hover:text-destructive transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
