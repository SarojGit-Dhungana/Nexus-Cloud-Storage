import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Activity, Database, Files, HardDrive, Users } from "lucide-react";
import { adminApi, dashboardApi } from "../api";
import { StorageMeter } from "../form-modals";
import { ACTIVITY_COLORS, BRAND, BRAND_SERIES } from "../lib/brand";
import { cn, formatByteCount } from "../lib/format";
import { StatCard } from "./StatCard";

export function AdminAnalytics() {
  const { data } = useQuery({ queryKey: ["admin", "analytics"], queryFn: dashboardApi.admin });
  const { data: settings } = useQuery({ queryKey: ["admin", "settings"], queryFn: adminApi.settings });
  const recentActivity = data?.recent_activity || [];
  const usedGb = (data?.total_storage ?? 0) / 1024 ** 3;
  const totalGb = (settings?.storage_quota_bytes ?? 0) / 1024 ** 3;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={String(data?.total_users ?? 0)} delta="live" deltaType="up" icon={Users} iconColor={BRAND.brick} />
        <StatCard label="Active Today" value={String(data?.active_today ?? 0)} delta="live" deltaType="up" icon={Activity} iconColor={BRAND.ember} />
        <StatCard label="Total Storage" value={formatByteCount(data?.total_storage ?? 0)} delta="live" deltaType="up" icon={Database} iconColor={BRAND.clay} />
        <StatCard label="Total Files Stored" value={String(data?.total_files ?? 0)} delta="live" deltaType="up" icon={Files} iconColor={BRAND.maroon} />
      </div>

      {totalGb > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <HardDrive className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Organization storage allocation</h3>
          </div>
          <StorageMeter usedGb={usedGb} totalGb={totalGb} />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-sm mb-1">User Growth</h3>
          <p className="text-xs text-muted-foreground mb-4">Registered users over 6 months</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data?.user_growth || []} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BRAND.brick} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={BRAND.brick} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="users" stroke={BRAND.brick} strokeWidth={2} fill="url(#colorUsers)" name="Users" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-sm mb-1">Weekly Activity</h3>
          <p className="text-xs text-muted-foreground mb-4">Uploads, downloads & deletes this week</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data?.activity_chart || []} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="uploads" name="Uploads" fill={BRAND.brick} radius={[4, 4, 0, 0]} />
              <Bar dataKey="downloads" name="Downloads" fill={BRAND.ember} radius={[4, 4, 0, 0]} />
              <Bar dataKey="deletes" name="Deletes" fill={BRAND.maroon} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Audit log — clear action types for admin tracking */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-sm">User activity tracker</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Tracks upload, delete, share, download and related actions across the organization
            </p>
          </div>
        </div>
        <div className="divide-y divide-border">
          {recentActivity.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">No tracked activity yet</p>
          ) : recentActivity.map((log: any) => (
            <div key={log.id} className="px-4 py-3.5 flex gap-3 items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: (ACTIVITY_COLORS[log.action_type || ""] || BRAND.bark) + "18" }}
              >
                <Activity className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold truncate">{log.user}</p>
                  <span className={cn(
                    "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium",
                    log.action_type === "upload" && "bg-emerald-500/15 text-emerald-600",
                    log.action_type === "delete" && "bg-red-500/15 text-red-600",
                    log.action_type === "share" && "bg-amber-500/15 text-amber-700",
                    log.action_type === "download" && "bg-sky-500/15 text-sky-700",
                    !["upload", "delete", "share", "download"].includes(log.action_type) && "bg-secondary text-muted-foreground",
                  )}>
                    {log.action_label || String(log.action).replaceAll("_", " ")}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
