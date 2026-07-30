import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Activity, Files, HardDrive, RefreshCw, Share2, Star, Upload } from "lucide-react";
import { dashboardApi } from "../api";
import { StorageMeter } from "../form-modals";
import { useExternalFileDrop } from "../hooks/useExternalFileDrop";
import { useUploadGuard } from "../hooks/useUploadGuard";
import { ACTIVITY_COLORS, BRAND, BRAND_SERIES } from "../lib/brand";
import { getFileIcon, toUiFile } from "../lib/files";
import { cn, formatBytes, formatByteCount } from "../lib/format";
import type { FileItem, UserProfile } from "../types/app-types";
import { StatCard } from "./StatCard";

export function DashboardView({ user }: { user: UserProfile }) {
  const { upload, storageFull } = useUploadGuard();
  const uploadFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    await upload(files);
  }, [upload]);
  const drop = useExternalFileDrop(uploadFiles);

  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.get });
  const stats = data?.stats;
  const activityData = data?.activity_chart?.length
    ? data.activity_chart.map((item: any) => ({ ...item, day: new Date(item.day).toLocaleDateString(undefined, { weekday: "short" }) }))
    : [];
  const storageData = (data?.storage_breakdown || []).map((item: any, index: number) => ({
    ...item,
    color: BRAND_SERIES[index % BRAND_SERIES.length],
  }));
  const recentFiles = (data?.recent_files || []).map(toUiFile);
  const recentActivity = data?.recent_activity || [];
  const usedGb = stats ? stats.storage_used / 1024 ** 3 : user.storage.used;
  const totalGb = stats ? stats.storage_total / 1024 ** 3 : user.storage.total;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Files" value={String(stats?.total_files ?? 0)} delta="live" deltaType="up" icon={Files} iconColor={BRAND.brick} />
        <StatCard label="Storage Used" value={formatByteCount(stats?.storage_used ?? 0)} delta="live" deltaType="up" icon={HardDrive} iconColor={BRAND.maroon} />
        <StatCard label="Shared Items" value={String(stats?.shared_items ?? 0)} delta="live" deltaType="up" icon={Share2} iconColor={BRAND.ember} />
        <StatCard label="Bandwidth" value={formatByteCount(stats?.bandwidth_bytes ?? 0)} delta="30d" deltaType="down" icon={Activity} iconColor={BRAND.clay} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Activity chart */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-sm">Activity Overview</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Last 7 days</p>
            </div>
            <select className="text-xs bg-secondary border-0 rounded-lg px-2 py-1 text-muted-foreground focus:outline-none">
              <option>This week</option>
              <option>Last month</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={activityData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="colorUp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BRAND.brick} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={BRAND.brick} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BRAND.ember} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={BRAND.ember} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "var(--foreground)", fontWeight: 500 }}
              />
              <Area type="monotone" dataKey="uploads" stroke={BRAND.brick} strokeWidth={2} fill="url(#colorUp)" name="Uploads" />
              <Area type="monotone" dataKey="downloads" stroke={BRAND.ember} strokeWidth={2} fill="url(#colorDl)" name="Downloads" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Storage breakdown */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-sm mb-1">Storage Breakdown</h3>
          <p className="text-xs text-muted-foreground mb-3">{formatByteCount(stats?.storage_used ?? 0)} used of {formatByteCount(stats?.storage_total ?? 0)}</p>
          <div className="mb-4">
            <StorageMeter usedGb={usedGb} totalGb={totalGb} compact />
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={storageData} cx="50%" cy="50%" innerRadius={42} outerRadius={60} dataKey="value" strokeWidth={0}>
                {storageData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {storageData.map((d: any) => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                <span className="text-xs text-muted-foreground flex-1">{d.name}</span>
                <span className="text-xs font-medium">{formatByteCount(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Drop zone + recent files */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {/* Drag & Drop */}
          <div
            {...(storageFull ? {} : drop.handlers)}
            className={cn(
              "relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 mb-4 overflow-hidden",
              storageFull
                ? "border-destructive/40 bg-destructive/5 cursor-pointer"
                : drop.active
                  ? "border-primary bg-accent scale-[1.01] shadow-md cursor-pointer"
                  : "border-border hover:border-primary/40 hover:bg-accent/30 cursor-pointer",
            )}
            onClick={() => { if (storageFull) void upload([]); }}
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-colors", storageFull ? "bg-destructive/10" : drop.active ? "bg-primary text-primary-foreground nexus-drop-pulse" : "bg-primary/10")}>
              <Upload className={cn("w-5 h-5", storageFull ? "text-destructive" : drop.active ? "text-primary-foreground" : "text-primary")} />
            </div>
            <p className="font-display text-xl">{storageFull ? "Storage allocation full" : drop.active ? "Drop to upload" : "Drop files to upload"}</p>
            <p className="font-hand text-sm text-muted-foreground mt-1.5">
              {storageFull ? "Free up space or increase the quota to upload again" : (
                <>
                  or{" "}
                  <label className="text-primary hover:underline cursor-pointer font-sans text-xs font-medium tracking-normal">
                    browse files
                    <input type="file" multiple className="hidden" onChange={e => uploadFiles(Array.from(e.target.files || []))} />
                  </label>
                </>
              )}
            </p>
          </div>

          {/* Recent files */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-sm">Recent Files</h3>
              <button className="text-xs text-primary hover:underline">View all</button>
            </div>
            <div>
              {recentFiles.map((file: FileItem, i: number) => (
                <div key={file.id} className={cn("flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors", i !== 4 && "border-b border-border")}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: file.color + "18" }}>
                    {getFileIcon(file.type, file.color)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{file.size !== "—" ? file.size + " · " : ""}{file.modified}</p>
                  </div>
                  {file.shared && <Share2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                  {file.starred && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Audit / recent activity */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-sm">Recent Activity</h3>
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border">
            {recentActivity.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No recent activity</p>
            ) : recentActivity.map((log: any) => (
              <div key={log.id} className="px-4 py-3 flex gap-3 items-start">
                <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: ACTIVITY_COLORS[log.action_type || log.type] || BRAND.bark }} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">
                    <span className="text-muted-foreground">{log.user}</span>
                    {" · "}
                    {log.action_label || String(log.action).replaceAll("_", " ")}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{new Date(log.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
