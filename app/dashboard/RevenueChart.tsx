"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Datum = { day: string; amount: number };

export function RevenueChart({ data }: { data: Datum[] }) {
  return (
    <div className="w-full select-none">
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.922 0 0)" vertical={false} />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6b5d52", fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6b5d52", fontSize: 11 }}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-md bg-foreground text-background text-xs px-2.5 py-1.5 shadow-lg">
                  <span className="font-medium">{label}</span>
                  <span className="ml-2">${(payload[0].value as number).toLocaleString()}</span>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="amount"
            fill="#c4907a"
            fillOpacity={0.15}
            stroke="#c4907a"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
