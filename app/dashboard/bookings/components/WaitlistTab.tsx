"use client";

import { Phone, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { categoryDot } from "../BookingsPage";
import type { Booking } from "../BookingsPage";

/**
 * WaitlistTab — Shows pending booking requests from clients.
 * These are automatically created when clients submit booking requests
 * from the public booking page. The admin can book or remove them.
 */
export function WaitlistTab({
  pendingBookings,
  onBook,
  onRemove,
}: {
  pendingBookings: Booking[];
  onBook: () => void;
  onRemove: (id: number) => void;
}) {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-0 pt-4 px-4 md:px-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            Pending Requests
            <span className="ml-2 text-xs text-muted font-normal">
              {pendingBookings.length} client{pendingBookings.length !== 1 ? "s" : ""}
            </span>
          </p>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-3">
        {pendingBookings.length === 0 ? (
          <div className="text-center py-10 px-4">
            <p className="text-sm text-muted">No pending requests right now.</p>
            <p className="text-xs text-muted/60 mt-1">
              When clients request bookings from your booking page, they&apos;ll appear here.
            </p>
          </div>
        ) : (
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
                    Notes
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden lg:table-cell">
                    Requested
                  </th>
                  <th className="px-4 md:px-5 pb-2.5" />
                </tr>
              </thead>
              <tbody>
                {pendingBookings.map((b) => {
                  const initials =
                    `${b.client.charAt(0)}${b.client.split(" ")[1]?.charAt(0) ?? ""}`.toUpperCase();
                  return (
                    <tr
                      key={b.id}
                      className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors group"
                    >
                      <td className="px-4 md:px-5 py-3 align-middle">
                        <div className="flex items-center gap-2.5">
                          <Avatar size="sm">
                            <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-foreground">{b.client}</p>
                            {b.clientPhone && (
                              <p className="text-[10px] text-muted flex items-center gap-0.5 mt-0.5">
                                <Phone className="w-2.5 h-2.5" />
                                {b.clientPhone}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell align-middle">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full shrink-0",
                              categoryDot(b.category),
                            )}
                          />
                          <span className="text-xs text-muted">{b.service}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <span className="text-xs text-foreground line-clamp-2">
                          {b.notes || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell align-middle">
                        <span className="text-xs text-muted">{b.date}</span>
                      </td>
                      <td className="px-4 md:px-5 py-3 align-middle">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                          <button
                            onClick={onBook}
                            className="text-[11px] text-accent hover:underline font-medium"
                          >
                            Book
                          </button>
                          <button
                            onClick={() => onRemove(b.id)}
                            className="p-1.5 rounded-md hover:bg-foreground/8 text-muted hover:text-destructive transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
