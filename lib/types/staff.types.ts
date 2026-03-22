/**
 * lib/types/staff.types.ts
 * Shared types for staff and shift management.
 * Source: app/dashboard/staff/actions.ts
 */

export type StaffRow = {
  id: string;
  name: string;
  initials: string;
  role: string;
  email: string;
  phone: string;
  specialties: string[];
  activeBookingsToday: number;
  totalShiftsMonth: number;
  status: "active" | "off_today" | "inactive";
  joinedDate: string;
  bio: string | null;
};

export type ShiftRow = {
  id: number;
  staffId: string;
  staffName: string;
  staffInitials: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  bookedSlots: number;
  notes: string | null;
};
