import { BarChart3, Building2, Cloud, Crown, Files, HardDrive, LayoutDashboard, Settings, Share2, Trash2, Upload, Users } from "lucide-react";
import { portalHome } from "../api";
import { StorageMeter } from "../form-modals";
import { useUploadGuard } from "../hooks/useUploadGuard";
import { BRAND } from "../lib/brand";
import { cn, formatBytes } from "../lib/format";
import type { UserProfile, View } from "../types/app-types";
import { AppAvatar } from "./AppAvatar";

const NAV_USER = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "files", label: "My Files", icon: Files },
  { id: "shared", label: "Shared", icon: Share2 },
  { id: "trash", label: "Trash", icon: Trash2 },
];
const NAV_ADMIN = [
  { id: "admin", label: "Analytics", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];
const NAV_SUPER_ADMIN = [
  { id: "workspaces", label: "Workspaces", icon: Building2 },
  { id: "administrators", label: "Administrators", icon: Crown },
];

export function Sidebar({
  user, view, onNav, collapsed,
}: {
  user: UserProfile; view: View; onNav: (v: View) => void; collapsed: boolean;
}) {
  const isSuperAdmin = user.role === "superadmin";
  const { upload, storageFull } = useUploadGuard();
  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    await upload(Array.from(files));
  };

  return (
    <aside className={cn(
      "h-screen flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 flex-shrink-0",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-sidebar-border flex-shrink-0">
        <div className="w-7 h-7 rounded-md nexus-mark flex items-center justify-center flex-shrink-0">
          <Cloud className="w-3.5 h-3.5 text-white" />
        </div>
        {!collapsed && <span className="ml-2.5 font-brand text-[1.15rem] leading-none">NexusStorage</span>}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {/* Upload button — super admins own no workspace storage */}
        {!isSuperAdmin && (!collapsed ? (
          <label
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 mb-3 rounded-lg text-sm font-medium transition-colors",
              storageFull
                ? "bg-destructive/15 text-destructive cursor-pointer"
                : "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer",
            )}
            onClick={event => {
              if (!storageFull) return;
              event.preventDefault();
              void upload([]);
            }}
          >
            <Upload className="w-4 h-4" />
            {storageFull ? "Storage full" : "New Upload"}
            <input type="file" multiple className="hidden" disabled={storageFull} onChange={event => uploadFiles(event.target.files)} />
          </label>
        ) : (
          <label
            className={cn(
              "w-full flex items-center justify-center p-2 mb-3 rounded-lg transition-colors",
              storageFull
                ? "bg-destructive/15 text-destructive cursor-pointer"
                : "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer",
            )}
            onClick={event => {
              if (!storageFull) return;
              event.preventDefault();
              void upload([]);
            }}
          >
            <Upload className="w-4 h-4" />
            <input type="file" multiple className="hidden" disabled={storageFull} onChange={event => uploadFiles(event.target.files)} />
          </label>
        ))}

        {isSuperAdmin ? (
          <>
            <div className={cn("text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1", collapsed ? "px-1 text-center text-[9px]" : "px-3")}>
              {collapsed ? "•••" : "System"}
            </div>
            {NAV_SUPER_ADMIN.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onNav(id as View)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                  collapsed && "justify-center",
                  view === id
                    ? "bg-sidebar-accent text-sidebar-primary font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && label}
              </button>
            ))}
          </>
        ) : (
          <>
            <div className={cn("text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1", collapsed ? "px-1 text-center text-[9px]" : "px-3")}>
              {collapsed ? "•••" : "Storage"}
            </div>
            {NAV_USER.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onNav(id as View)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                  collapsed && "justify-center",
                  view === id
                    ? "bg-sidebar-accent text-sidebar-primary font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && label}
              </button>
            ))}
          </>
        )}

        {user.role === "admin" && (
          <>
            <div className={cn("text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-4 mb-1", collapsed ? "px-1 text-center text-[9px]" : "px-3")}>
              {collapsed ? "•••" : "Admin"}
            </div>
            {NAV_ADMIN.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onNav(id as View)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                  collapsed && "justify-center",
                  view === id
                    ? "bg-sidebar-accent text-sidebar-primary font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && label}
              </button>
            ))}
          </>
        )}
      </nav>

      {/* Storage meter */}
      {!collapsed && !isSuperAdmin && (
        <div className="p-4 border-t border-sidebar-border">
          <StorageMeter usedGb={user.storage.used} totalGb={user.storage.total} compact />
        </div>
      )}
    </aside>
  );
}
