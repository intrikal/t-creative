export type Trend = "up" | "down" | "neutral";

export type BookingStatus =
  | "completed"
  | "in_progress"
  | "confirmed"
  | "pending"
  | "cancelled"
  | "no_show";

export type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting" | "3d_printing" | "aesthetics";
export type InquiryStatus = "new" | "read" | "replied" | "archived";

export interface AdminStats {
  revenueTodayCents: number;
  revenueTodayVsYesterdayPct: number | null;
  appointmentsToday: number;
  appointmentsRemaining: number;
  activeClientsThisMonth: number;
  newClientsThisWeek: number;
  waitlistTotal: number;
  waitlistNotContacted: number;
  outstandingCents: number;
  unpaidInvoiceCount: number;
  openInquiries: number;
  newInquiriesToday: number;
  lowStockProducts: number;
  lowStockSupplies: number;
}

export interface AdminBooking {
  id: number;
  time: string;
  service: string;
  category: ServiceCategory;
  client: string;
  clientInitials: string;
  staff: string;
  status: BookingStatus;
  durationMin: number;
  location?: string;
}

export interface AdminInquiry {
  id: number;
  name: string;
  initials: string;
  interest: ServiceCategory | null;
  message: string;
  time: string;
  status: InquiryStatus;
}

export interface AdminClient {
  id: string;
  name: string;
  initials: string;
  source: string | null;
  joinedAgo: string;
  vip: boolean;
  services: string[];
}

export interface AdminAlert {
  id: string;
  type: "warning" | "error" | "info";
  message: string;
  href: string;
  cta: string;
}

export interface AdminStaff {
  initials: string;
  name: string;
  role: string | null;
  hours: string;
  status: "active" | "on_leave";
}

export interface DashboardPageProps {
  firstName: string;
  lowStockCount: number;
  stats: AdminStats;
  alerts: AdminAlert[];
  todayBookings: AdminBooking[];
  inquiries: AdminInquiry[];
  weeklyRevenue: { day: string; amount: number }[];
  weeklyRevenueTotal: number;
  weeklyRevenueVsPriorPct: number | null;
  recentClients: AdminClient[];
  teamToday: AdminStaff[];
  setup?: {
    studioName: string | null;
    locationArea: string | null;
    socialCount: number;
    hasPolicies: boolean;
    hasDeposits: boolean;
  };
  bookingSlug?: string;
}
