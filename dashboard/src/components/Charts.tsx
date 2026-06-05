"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const colors = ["#67e8f9", "#a7f3d0", "#fcd34d", "#fda4af", "#c4b5fd", "#94a3b8"];

export function groupCounts<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = String(row[key] || "unknown");
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
}

export function BarSummary({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} width={28} tick={{ fontSize: 12, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: "#09090b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fafafa" }} />
        <Bar dataKey="value" radius={[5, 5, 0, 0]} fill="#67e8f9" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PieSummary({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={46} outerRadius={76} paddingAngle={2}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ background: "#09090b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fafafa" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function AreaSummary({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="chartCyan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#67e8f9" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#67e8f9" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} width={28} tick={{ fontSize: 12, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: "#09090b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fafafa" }} />
        <Area type="monotone" dataKey="value" stroke="#67e8f9" strokeWidth={2} fill="url(#chartCyan)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
