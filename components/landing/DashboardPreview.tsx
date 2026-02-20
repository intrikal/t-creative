/**
 * DashboardPreview — Animated mockup of the studio admin dashboard with stats, chart, and bookings.
 *
 * Client Component — uses Framer Motion for staggered reveal of sidebar, stats, chart bars, and booking rows.
 */
"use client";

import { motion } from "framer-motion";

const sidebarItems = [
  "Bookings",
  "Calendar",
  "Messages",
  "Clients",
  "Analytics",
  "Marketplace",
  "Media",
  "Settings",
];

const stats = [
  { label: "Revenue", value: "$11,610", change: "+15.3%" },
  { label: "Bookings", value: "47", change: "+12.5%" },
  { label: "Avg Rating", value: "4.8", change: "★" },
  { label: "Repeat Rate", value: "100%", change: "" },
];

export function DashboardPreview() {
  return (
    <section className="py-32 md:py-48 px-6 bg-surface">
      <div className="mx-auto max-w-6xl">
        <motion.div
          className="mb-16 md:mb-20 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-xs tracking-widest uppercase text-muted mb-6 block">
            The Platform
          </span>
          <h2 className="text-3xl md:text-5xl font-light tracking-tight text-foreground mb-4">
            Manage your studio.
          </h2>
          <p className="text-muted text-base max-w-lg mx-auto">
            Bookings, clients, analytics, and media — all from one dashboard built for creative
            professionals.
          </p>
        </motion.div>

        {/* Dashboard mockup */}
        <motion.div
          className="bg-foreground rounded-lg overflow-hidden shadow-2xl"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-white/20" />
              <div className="w-3 h-3 rounded-full bg-white/20" />
              <div className="w-3 h-3 rounded-full bg-white/20" />
            </div>
            <span className="text-xs text-white/40 ml-2">T Creative Studio — Dashboard</span>
          </div>

          <div className="flex min-h-[400px] md:min-h-[480px]">
            {/* Sidebar */}
            <div className="hidden md:flex flex-col w-52 border-r border-white/10 py-4">
              <div className="px-5 pb-4 mb-2 border-b border-white/10">
                <p className="text-sm font-medium text-white">Trini Lam</p>
                <p className="text-xs text-white/40">Admin</p>
              </div>
              {sidebarItems.map((item, i) => (
                <motion.div
                  key={item}
                  className={`px-5 py-2 text-xs ${
                    i === 0 ? "text-accent bg-white/5" : "text-white/50 hover:text-white/80"
                  } transition-colors`}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: 0.4 + i * 0.05 }}
                >
                  {item}
                </motion.div>
              ))}
            </div>

            {/* Main content */}
            <div className="flex-1 p-6 md:p-8">
              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {stats.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    className="bg-white/5 rounded-md p-4"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.5 + i * 0.08 }}
                  >
                    <p className="text-xs text-white/40 mb-1">{stat.label}</p>
                    <p className="text-xl font-light text-white">{stat.value}</p>
                    {stat.change && <p className="text-xs text-accent mt-1">{stat.change}</p>}
                  </motion.div>
                ))}
              </div>

              {/* Chart placeholder */}
              <div className="bg-white/5 rounded-md p-5 mb-6">
                <p className="text-xs text-white/40 mb-4">Revenue — Last 30 days</p>
                <div className="flex items-end gap-1.5 h-24">
                  {[40, 55, 35, 65, 50, 70, 60, 80, 75, 90, 85, 95].map((h, i) => (
                    <motion.div
                      key={i}
                      className="flex-1 bg-accent/40 rounded-t-sm"
                      initial={{ height: 0 }}
                      whileInView={{ height: `${h}%` }}
                      viewport={{ once: true }}
                      transition={{
                        duration: 0.5,
                        delay: 0.7 + i * 0.05,
                        ease: "easeOut",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Recent bookings placeholder */}
              <div className="space-y-2">
                {[
                  "Classic Lash Set — 10:00 AM",
                  "Permanent Bracelet — 2:00 PM",
                  "Volume Fill — 4:30 PM",
                ].map((booking, i) => (
                  <motion.div
                    key={booking}
                    className="flex items-center justify-between bg-white/5 rounded-md px-4 py-3"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: 1 + i * 0.1 }}
                  >
                    <span className="text-xs text-white/70">{booking}</span>
                    <span className="text-xs text-accent">Confirmed</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
