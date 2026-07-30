import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Bot, ChevronDown, History, Key, Lock, LogOut, Menu, Moon, Search, Sun, User, X } from "lucide-react";
import { authenticatedPreview, dashboardApi, fileApi } from "../api";
import { AVATAR_COLORS, BRAND } from "../lib/brand";
import { getFileIcon } from "../lib/files";
import { cn } from "../lib/format";
import type { Theme, UserProfile, View } from "../types/app-types";
import { AppAvatar } from "./AppAvatar";
import { AppBadge } from "./AppBadge";

export function Header({
  user, theme, onTheme, onMenu, onChat, chatOpen, onLogout, onNav,
}: {
  user: UserProfile; theme: Theme; onTheme: () => void;
  onMenu: () => void; onChat: () => void; chatOpen: boolean; onLogout: () => void;
  onNav: (v: View) => void;
}) {
  const [search, setSearch] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { data: searchResults = [] } = useQuery({
    queryKey: ["search", search],
    queryFn: () => fileApi.search(search),
    enabled: search.trim().length >= 2,
  });
  const { data: notifications = [] } = useQuery({
    queryKey: ["activity", "notifications"],
    queryFn: dashboardApi.activity,
  });
  const profileAction = (label: string) => {
    setProfileOpen(false);
    if (label === "Activity") {
      setNotifOpen(true);
    } else {
      // Profile and Security both open the full profile page.
      onNav("profile");
    }
  };

  return (
    <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-card flex-shrink-0 relative z-20">
      <button onClick={onMenu} className="lg:hidden p-1.5 rounded-lg hover:bg-secondary transition-colors">
        <Menu className="w-4 h-4" />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-xl relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search files, folders, people…"
          className="w-full pl-9 pr-4 py-1.5 text-sm rounded-lg bg-secondary border border-transparent focus:border-primary/30 focus:outline-none focus:bg-background transition-colors placeholder:text-muted-foreground"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
        {search.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-border bg-popover shadow-xl overflow-hidden max-h-80 overflow-y-auto">
            {searchResults.length ? searchResults.map(file => (
              <button key={file.id} onClick={() => {
                if (file.node_type === "file") authenticatedPreview(file.id).catch(error => toast.error(error.message));
                setSearch("");
              }} className="w-full flex items-center gap-3 p-3 text-left hover:bg-secondary border-b border-border last:border-0">
                {getFileIcon(file.type, BRAND.brick)}
                <span className="flex-1 min-w-0"><span className="block text-sm font-medium truncate">{file.name}</span><span className="block text-xs text-muted-foreground">{file.owner}</span></span>
              </button>
            )) : <p className="p-4 text-sm text-muted-foreground text-center">No matching files</p>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 ml-auto">
        {/* AI chat toggle */}
        <button
          onClick={onChat}
          className={cn("p-2 rounded-lg transition-colors relative", chatOpen ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground")}
          title="AI Assistant"
        >
          <Bot className="w-4 h-4" />
        </button>

        {/* Theme */}
        <button
          onClick={onTheme}
          className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            {notifications.length > 0 && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
              <div className="p-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-medium">Notifications</span>
                <span className="text-xs text-muted-foreground">Recent activity</span>
              </div>
              {notifications.slice(0, 5).map(n => {
                const sealed = Boolean(n.encrypted) || String(n.action || "").startsWith("enc://");
                return (
                <div key={n.id} className="p-3 border-b border-border last:border-0 flex gap-3">
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug">{n.user}</p>
                    {sealed ? (
                      <p className="text-[11px] font-mono text-muted-foreground mt-0.5 truncate flex items-center gap-1">
                        <Lock className="w-3 h-3 text-primary flex-shrink-0" />
                        {String(n.action_label || n.action).replaceAll("_", " ")}
                      </p>
                    ) : (
                      <p className="text-sm leading-snug text-muted-foreground">
                        {String(n.action_label || n.action).replaceAll("_", " ")}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(n.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              );})}
              {!notifications.length && <p className="p-4 text-sm text-muted-foreground text-center">No recent activity</p>}
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative ml-1">
          <button
            onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-secondary transition-colors"
          >
            <AppAvatar initials={user.name.split(" ").map(n => n[0]).join("")} size="sm" />
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
              <div className="p-3 border-b border-border">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <AppBadge variant={user.role === "admin" ? "warning" : "muted"} >{user.role}</AppBadge>
              </div>
              {[
                { icon: User, label: "Profile" },
                { icon: Key, label: "Security" },
                { icon: History, label: "Activity" },
              ].map(({ icon: Icon, label }) => (
                <button key={label} onClick={() => profileAction(label)} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-secondary transition-colors">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  {label}
                </button>
              ))}
              <div className="border-t border-border">
                <button onClick={onLogout} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors">
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
