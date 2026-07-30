import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Shield } from "lucide-react";
import { ApiUser, authApi, clearTokens, Portal, portalForRole } from "../api";
import { isStorageFull, StorageFullNotice, wouldExceedStorage } from "../form-modals";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useExternalFileDrop } from "../hooks/useExternalFileDrop";
import { UploadGuardContext } from "../hooks/useUploadGuard";
import { toUserProfile, uploadFilesWithVirusScan, type UploadScanProgress } from "../lib/files";
import { cn, formatBytes } from "../lib/format";
import type { Theme, UserProfile, View } from "../types/app-types";
import { AdminAnalytics } from "./AdminAnalytics";
import { AdministratorsView } from "./AdministratorsView";
import { AuthScreen } from "./AuthScreen";
import { ChatPanel } from "./ChatPanel";
import { DashboardView } from "./DashboardView";
import { DropOverlay } from "./DropOverlay";
import { FileScanDialog } from "./FileScanDialog";
import { FilesView } from "./FilesView";
import { Header } from "./Header";
import { ProfileView } from "./ProfileView";
import { SharedView } from "./SharedView";
import { Sidebar } from "./Sidebar";
import { SystemSettings } from "./SystemSettings";
import { TrashView } from "./TrashView";
import { UserManagement } from "./UserManagement";
import { WorkspacesView } from "./WorkspacesView";
import { BOOT_DURATION_MS, WorkspaceLoader } from "./WorkspaceLoader";

export function AppContent({ portal }: { portal: Portal }) {
  // TanStack: load current user instead of manual useEffect + fetch
  const { data: apiUser, isLoading: authLoading, refetch } = useCurrentUser(portal);
  const [bootAnimationDone, setBootAnimationDone] = useState(false);
  const [view, setView] = useState<View>(portal === "system" ? "workspaces" : "dashboard");
  const [theme, setTheme] = useState<Theme>("light");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [userOverride, setUserOverride] = useState<UserProfile | null>(null);

  const user = userOverride ?? (apiUser ? toUserProfile(apiUser) : null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    const timer = window.setTimeout(() => setBootAnimationDone(true), BOOT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (apiUser?.role === "superadmin") setView("workspaces");
  }, [apiUser?.role]);

  const handleAuthenticated = (nextUser: ApiUser) => {
    const expected = portalForRole(nextUser.role);
    if (expected !== portal) return;
    setUserOverride(toUserProfile(nextUser));
    setView(nextUser.role === "superadmin" ? "workspaces" : "dashboard");
    void refetch();
  };

  if (authLoading || !bootAnimationDone) return <WorkspaceLoader />;

  if (!user) return <AuthScreen portal={portal} onAuthenticated={handleAuthenticated} />;

  return (
    <AuthenticatedShell
      user={user}
      setUser={(value) => {
        setUserOverride(typeof value === "function" ? value(user) : value);
        if (value === null) clearTokens(portal);
      }}
      view={view}
      setView={setView}
      theme={theme}
      setTheme={setTheme}
      sidebarCollapsed={sidebarCollapsed}
      setSidebarCollapsed={setSidebarCollapsed}
      mobileSidebar={mobileSidebar}
      setMobileSidebar={setMobileSidebar}
      chatOpen={chatOpen}
      setChatOpen={setChatOpen}
    />
  );
}

export function AuthenticatedShell({
  user, setUser, view, setView, theme, setTheme,
  sidebarCollapsed, setSidebarCollapsed, mobileSidebar, setMobileSidebar, chatOpen, setChatOpen,
}: {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  view: View;
  setView: React.Dispatch<React.SetStateAction<View>>;
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  mobileSidebar: boolean;
  setMobileSidebar: React.Dispatch<React.SetStateAction<boolean>>;
  chatOpen: boolean;
  setChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const queryClient = useQueryClient();
  const [storageFullOpen, setStorageFullOpen] = useState(false);
  const [scanProgress, setScanProgress] = useState<UploadScanProgress | null>(null);
  const storageFull = isStorageFull(user.storage);

  const refreshUserStorage = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(toUserProfile(me));
    } catch {
      // keep existing profile if refresh fails
    }
  }, [setUser]);

  const guardedUpload = useCallback(async (files: File[], parent?: string) => {
    if (user.role === "superadmin") return;
    if (!files.length) {
      if (storageFull) setStorageFullOpen(true);
      return;
    }
    if (storageFull || wouldExceedStorage(user.storage, files.reduce((sum, file) => sum + file.size, 0))) {
      setStorageFullOpen(true);
      return;
    }
    try {
      await uploadFilesWithVirusScan(files, parent, setScanProgress);
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "analytics"] });
      await refreshUserStorage();
    } catch (error) {
      if (error instanceof ApiError && (error.status === 413 || /quota|storage/i.test(error.message))) {
        setScanProgress(null);
        setStorageFullOpen(true);
        await refreshUserStorage();
        return;
      }
      // Error details are shown in FileScanDialog
    }
  }, [user.role, user.storage, storageFull, queryClient, refreshUserStorage]);

  const uploadAnywhere = useCallback(async (files: File[]) => {
    await guardedUpload(files);
  }, [guardedUpload]);
  const drop = useExternalFileDrop(uploadAnywhere);

  const renderView = () => {
    const isSuperAdmin = user.role === "superadmin";
    const denied = (message: string) => (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium">Access Denied</p>
          <p className="text-sm text-muted-foreground mt-1">{message}</p>
        </div>
      </div>
    );
    if (["workspaces", "administrators"].includes(view) && !isSuperAdmin) {
      return denied("System super administrator privileges required");
    }
    if (["admin", "users", "settings"].includes(view) && user.role !== "admin") {
      return denied("Admin privileges required");
    }
    // Super admins have no workspace storage, so keep them on system views.
    if (isSuperAdmin && !["workspaces", "administrators", "profile"].includes(view)) {
      return <WorkspacesView />;
    }
    switch (view) {
      case "dashboard": return <DashboardView user={user} />;
      case "files": return <FilesView />;
      case "shared": return <SharedView />;
      case "trash": return <TrashView />;
      case "admin": return <AdminAnalytics />;
      case "users": return <UserManagement currentUserId={user.id} />;
      case "settings": return <SystemSettings />;
      case "workspaces": return <WorkspacesView />;
      case "administrators": return <AdministratorsView />;
      case "profile": return <ProfileView user={user} onUserUpdate={(apiUser) => setUser(toUserProfile(apiUser))} />;
      default: return <DashboardView user={user} />;
    }
  };

  return (
    <UploadGuardContext.Provider value={{ upload: guardedUpload, storageFull }}>
      <div
        className="h-screen relative flex overflow-hidden bg-background font-sans animate-in fade-in duration-500"
        {...(user.role === "superadmin" || storageFull ? {} : drop.handlers)}
      >
        <DropOverlay active={drop.active} label="Drop anywhere to upload" />
        <StorageFullNotice
          open={storageFullOpen}
          usedLabel={formatBytes(user.storage.used)}
          totalLabel={formatBytes(user.storage.total)}
          onClose={() => setStorageFullOpen(false)}
        />
        <FileScanDialog progress={scanProgress} onClose={() => setScanProgress(null)} />

        {mobileSidebar && (
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileSidebar(false)} />
        )}

        <div className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 lg:z-0 transition-transform duration-300",
          mobileSidebar ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
          <Sidebar user={user} view={view} onNav={(v) => { setView(v); setMobileSidebar(false); }} collapsed={sidebarCollapsed} />
        </div>

        <button
          onClick={() => setSidebarCollapsed(p => !p)}
          className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 z-30 w-5 h-8 items-center justify-center rounded-r-md bg-border hover:bg-primary/20 transition-colors"
          style={{ left: sidebarCollapsed ? "3.75rem" : "14.75rem" }}
        >
          {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronRight className="w-3 h-3 rotate-180" />}
        </button>

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header
            user={user}
            theme={theme}
            onTheme={() => setTheme(t => t === "dark" ? "light" : "dark")}
            onMenu={() => setMobileSidebar(true)}
            onChat={() => setChatOpen(p => !p)}
            chatOpen={chatOpen}
            onLogout={() => { authApi.logout(); setUser(null); }}
            onNav={setView}
          />

          <div className="flex-1 flex overflow-hidden">
            <main className="flex-1 overflow-y-auto">
              <div className="max-w-6xl mx-auto p-5 lg:p-6">
                {user.twoFactorRequired && !user.twoFactorEnabled && (
                  <div className="mb-5 p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-sm">
                    Your organization requires two-factor authentication. Open <strong>Profile → Security</strong> to enroll before using storage APIs.
                  </div>
                )}
                {renderView()}
              </div>
            </main>

            {chatOpen && (
              <div className="hidden sm:flex flex-shrink-0 h-full overflow-hidden">
                <ChatPanel user={user} onClose={() => setChatOpen(false)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </UploadGuardContext.Provider>
  );
}
