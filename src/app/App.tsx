import { useState, useRef, useCallback, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import {
  adminApi, ApiFile, ApiUser, authenticatedDownload, authenticatedPreview, authApi, chatApi,
  clearTokens, dashboardApi, fileApi, OrganizationSettings, portalForRole,
  portalHome, portalLabel, Portal, superAdminApi, SystemUser, Workspace,
} from "./api";
import {
  LayoutDashboard, Files, Share2, Trash2, Settings, Users, BarChart3,
  Upload, Search, Bell, Moon, Sun, Menu, X, ChevronRight, MoreHorizontal,
  Grid3X3, List, Folder, FileText, Archive, Download, Link,
  Star, Eye, Trash, Copy, Move, Shield, LogOut, Plus,
  ArrowUpRight, ArrowDownRight, HardDrive, Cloud, Activity, Lock,
  Send, Bot, ChevronDown, RefreshCw, UserPlus,
  Globe, Database, Cpu, FileImage, FileCode,
  FileVideo, SlidersHorizontal, Check,
  Sparkles, User, Key, History,
  Mail, QrCode, ShieldCheck, Loader2, ShieldAlert, Home, FolderOpen, Building2, Crown,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────
type Role = "superadmin" | "admin" | "user";
type View =
  | "dashboard" | "files" | "shared" | "trash" | "admin" | "users" | "settings" | "profile"
  | "workspaces" | "administrators";
type FileType = "folder" | "image" | "video" | "document" | "archive" | "code" | "pdf";
type ViewMode = "grid" | "list";
type Theme = "light" | "dark";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  storage: { used: number; total: number };
  twoFactorEnabled: boolean;
  twoFactorRequired: boolean;
}

interface FileItem {
  id: string;
  name: string;
  type: FileType;
  size: string;
  modified: string;
  shared: boolean;
  starred: boolean;
  owner: string;
  color: string;
}

interface ChatMessage {
  id: string;
  from: "user" | "ai";
  text: string;
  time: string;
}

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

// Brand ramp shared with theme.css, used where charts and icons need literal colors.
const BRAND = {
  maroon: "#60241E",
  rust: "#7B2A1F",
  brick: "#95271D",
  clay: "#B34A44",
  ember: "#E77B49",
  sand: "#F0A47D",
  bark: "#8A6055",
};
const BRAND_SERIES = [BRAND.brick, BRAND.ember, BRAND.clay, BRAND.maroon, BRAND.sand, BRAND.rust];
// Deeper tones only, so white initials stay legible.
const AVATAR_COLORS = [BRAND.brick, BRAND.maroon, BRAND.clay, BRAND.rust, BRAND.bark, "#A8402B"];
const ACTIVITY_COLORS: Record<string, string> = {
  share: BRAND.brick, upload: BRAND.ember, download: BRAND.clay,
  system: BRAND.bark, admin: BRAND.maroon, create: BRAND.sand, delete: BRAND.maroon,
};
const NEXUS_FILE_MIME = "application/x-nexus-file-id";

function hasExternalFiles(event: React.DragEvent) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

function useExternalFileDrop(onFiles: (files: File[]) => void) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);

  const onDragEnter = useCallback((event: React.DragEvent) => {
    if (!hasExternalFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    depth.current += 1;
    setActive(true);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    if (!hasExternalFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent) => {
    if (!hasExternalFiles(event)) return;
    event.stopPropagation();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setActive(false);
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    if (!hasExternalFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    depth.current = 0;
    setActive(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length) onFiles(files);
  }, [onFiles]);

  return { active, handlers: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}

function DropOverlay({ active, label = "Drop files to upload" }: { active: boolean; label?: string }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-[2px]">
      <div className="mx-6 w-full max-w-md rounded-2xl border-2 border-dashed border-primary bg-card/95 p-8 text-center shadow-xl nexus-drop-pulse">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Upload className="h-6 w-6 text-primary" />
        </div>
        <p className="font-display text-2xl text-foreground">{label}</p>
        <p className="font-hand mt-2 text-sm text-muted-foreground">Release to add them to your workspace</p>
      </div>
    </div>
  );
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatBytes(gb: number) {
  return `${gb.toFixed(1)} GB`;
}

function formatByteCount(bytes: number) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

/** Scan every file first; only upload after the antivirus API allows it. */
async function uploadFilesWithVirusScan(files: File[], parent?: string) {
  const list = Array.from(files);
  if (!list.length) return [];
  const toastId = toast.loading(
    list.length === 1
      ? `Scanning "${list[0].name}" for viruses…`
      : `Scanning ${list.length} files for viruses…`,
  );
  const saved = [];
  try {
    for (const file of list) {
      toast.loading(`Scanning "${file.name}"…`, { id: toastId });
      const scan = await fileApi.scan(file);
      if (!scan.clean || !scan.allowed) {
        throw new Error(scan.detail || `Virus detected (${scan.threat}). Upload blocked.`);
      }
      toast.loading(`Clean — uploading "${file.name}"…`, { id: toastId });
      saved.push(await fileApi.store(file, parent));
    }
    toast.success(
      saved.length === 1
        ? `Scanned clean and uploaded "${saved[0].name}"`
        : `Scanned clean and uploaded ${saved.length} files`,
      { id: toastId },
    );
    return saved;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Upload blocked by virus scan", { id: toastId });
    throw error;
  }
}

function toUserProfile(user: ApiUser): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar_url,
    storage: { used: user.storage_used / 1024 ** 3, total: user.storage_total / 1024 ** 3 },
    twoFactorEnabled: user.two_factor_enabled,
    twoFactorRequired: user.two_factor_required,
  };
}

function toUiFile(file: ApiFile): FileItem {
  const colors: Record<string, string> = {
    folder: BRAND.ember, image: BRAND.clay, video: BRAND.maroon, pdf: BRAND.brick,
    code: BRAND.sand, archive: BRAND.bark, document: BRAND.rust,
  };
  return {
    id: file.id,
    name: file.name,
    type: file.type,
    size: formatByteCount(file.size),
    modified: new Date(file.modified).toLocaleString(),
    shared: file.shared,
    starred: file.starred,
    owner: file.owner,
    color: colors[file.type] || BRAND.brick,
  };
}

function getFileIcon(type: FileType, color: string) {
  const cls = "w-5 h-5 flex-shrink-0";
  switch (type) {
    case "folder": return <Folder className={cls} style={{ color }} />;
    case "image": return <FileImage className={cls} style={{ color }} />;
    case "video": return <FileVideo className={cls} style={{ color }} />;
    case "pdf": return <FileText className={cls} style={{ color }} />;
    case "code": return <FileCode className={cls} style={{ color }} />;
    case "archive": return <Archive className={cls} style={{ color }} />;
    default: return <FileText className={cls} style={{ color }} />;
  }
}

// ─── Workspace Loader ─────────────────────────────────────────────────────────
// Shown before anything else so the app never flashes straight into the login form.
const BOOT_STEPS = ["Establishing secure channel", "Restoring your session", "Preparing workspace"];
const BOOT_DURATION_MS = 1900;

function WorkspaceLoader() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setStep(current => Math.min(current + 1, BOOT_STEPS.length - 1)),
      BOOT_DURATION_MS / (BOOT_STEPS.length + 0.5),
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="h-screen relative flex items-center justify-center overflow-hidden bg-background font-sans">
      <div className="absolute inset-0 nexus-boot-glow" />

      <div className="relative w-full max-w-sm px-8">
        <div className="flex flex-col items-center text-center">
          <div className="relative w-16 h-16 mb-5">
            <span className="absolute -inset-2 rounded-3xl bg-primary/25 blur-xl nexus-boot-ring" />
            <div className="relative w-16 h-16 rounded-2xl nexus-mark flex items-center justify-center shadow-lg">
              <Cloud className="w-7 h-7 text-white" />
            </div>
          </div>
          <span className="font-brand text-[1.85rem] text-foreground">NexusStorage</span>
          <p className="font-script text-[1.05rem] text-primary/80 mt-2">almost ready</p>
          <p className="font-hand text-[0.9rem] text-muted-foreground mt-1">Warming up your workspace</p>
        </div>

        <div className="h-1.5 rounded-full bg-secondary overflow-hidden mt-8">
          <div className="h-full rounded-full nexus-boot-bar" />
        </div>

        <ul className="mt-6 space-y-2.5">
          {BOOT_STEPS.map((label, index) => (
            <li
              key={label}
              className={cn(
                "flex items-center gap-2.5 text-xs transition-colors duration-300",
                index <= step ? "text-foreground" : "text-muted-foreground/50",
              )}
            >
              {index < step ? (
                <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              ) : index === step ? (
                <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin flex-shrink-0" />
              ) : (
                <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                </span>
              )}
              {label}
            </li>
          ))}
        </ul>

        <p className="mt-9 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="w-3 h-3" />
          Encrypted transport · Organization-isolated data
        </p>
      </div>
    </div>
  );
}

// ─── Authentication ───────────────────────────────────────────────────────────
function AuthScreen({
  portal,
  onAuthenticated,
}: {
  portal: Portal;
  onAuthenticated: (user: ApiUser) => void;
}) {
  const inviteToken = new URLSearchParams(window.location.search).get("invite");
  const [mode, setMode] = useState<"login" | "organization" | "user">(
    portal === "admin" ? "login" : portal === "user" ? "login" : "login",
  );
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const user = inviteToken
        ? await authApi.acceptInvitation(inviteToken, name, password)
        : mode === "organization"
        ? await authApi.register({
            name,
            email,
            password,
            account_type: "organization",
            organization_name: organization,
          })
        : mode === "user"
        ? await authApi.register({
            name,
            email,
            password,
            account_type: "user",
            organization_slug: organizationSlug,
          })
        : await authApi.login(email, password, otp);

      const expected = portalForRole(user.role);
      if (expected !== portal) {
        toast.message(`This account belongs on the ${portalLabel(expected)} portal — redirecting`);
        // authenticateAndRoute already redirected; stop local render.
        return;
      }
      if (inviteToken) window.history.replaceState({}, "", window.location.pathname);
      onAuthenticated(user);
      toast.success(
        inviteToken
          ? "Invitation accepted"
          : mode === "organization"
          ? "Workspace created"
          : mode === "user"
          ? "Account created"
          : "Welcome back",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const title = inviteToken
    ? "Join your workspace"
    : mode === "organization"
    ? "Create your workspace"
    : mode === "user"
    ? "Create a user account"
    : `${portalLabel(portal)} sign in`;
  const subtitle = inviteToken
    ? "Complete your invited team account"
    : mode === "organization"
    ? "You become the organization administrator"
    : mode === "user"
    ? "Join an existing organization as a regular user"
    : portal === "system"
    ? "System console — manage workspaces and administrators"
    : portal === "admin"
    ? "Organization administrator portal"
    : "Member portal — files, sharing, and AI assistant";

  return (
    <div className="min-h-screen relative overflow-hidden bg-background flex items-center justify-center p-6 animate-in fade-in duration-500">
      <div className="absolute inset-0 nexus-boot-glow opacity-60" />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-xl nexus-mark flex items-center justify-center shadow-sm">
              <Cloud className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-brand text-[1.65rem] text-foreground">NexusStorage</span>
          </div>
          <h1 className="font-display text-[2rem] mb-2">{title}</h1>
          <p className="font-hand text-[0.95rem] text-muted-foreground">{subtitle}</p>
        </div>
        <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
          {(mode !== "login" || inviteToken) && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Your name</label>
              <input required value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
            </div>
          )}
          {mode === "organization" && !inviteToken && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Organization name</label>
              <input required value={organization} onChange={e => setOrganization(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
            </div>
          )}
          {mode === "user" && !inviteToken && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Organization slug</label>
              <input required value={organizationSlug} onChange={e => setOrganizationSlug(e.target.value.toLowerCase().trim())} placeholder="acme-corporation" className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
              <p className="text-[11px] text-muted-foreground mt-1">
                Use the slug from Settings. If the admin turned off self-registration, you need an invite link instead.
              </p>
            </div>
          )}
          {!inviteToken && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Email</label>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Password</label>
            <input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
          </div>
          {mode === "login" && !inviteToken && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Authenticator code <span className="font-normal">(if enabled)</span></label>
              <input inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
            </div>
          )}
          <button disabled={loading} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50">
            {loading
              ? "Please wait…"
              : inviteToken
              ? "Join workspace"
              : mode === "organization"
              ? "Create workspace"
              : mode === "user"
              ? "Create user account"
              : "Sign in"}
          </button>
          {!inviteToken && (
            <div className="space-y-2 text-center">
              {mode !== "login" && (
                <button type="button" onClick={() => setMode("login")} className="block w-full text-sm text-primary hover:underline">
                  Already have an account? Sign in
                </button>
              )}
              {portal === "admin" && mode !== "organization" && (
                <button type="button" onClick={() => setMode("organization")} className="block w-full text-sm text-primary hover:underline">
                  New organization? Create as admin
                </button>
              )}
              {portal === "user" && mode !== "user" && (
                <button type="button" onClick={() => setMode("user")} className="block w-full text-sm text-primary hover:underline">
                  Join an organization as a user
                </button>
              )}
              <a href="/" className="block w-full text-xs text-muted-foreground hover:text-primary hover:underline">
                Switch portal
              </a>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ initials, size = "md", color }: { initials: string; size?: "sm" | "md" | "lg"; color?: string }) {
  const s = { sm: "w-7 h-7 text-xs", md: "w-8 h-8 text-sm", lg: "w-10 h-10 text-base" }[size];
  return (
    <div className={cn(s, "rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0")} style={{ background: color || BRAND.brick }}>
      {initials}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "danger" | "muted" }) {
  const v = {
    default: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-red-500/10 text-red-500",
    muted: "bg-secondary text-muted-foreground",
  }[variant];
  return <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", v)}>{children}</span>;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
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

function Sidebar({
  user, view, onNav, collapsed,
}: {
  user: UserProfile; view: View; onNav: (v: View) => void; collapsed: boolean;
}) {
  const isSuperAdmin = user.role === "superadmin";
  const storePct = user.storage.total ? (user.storage.used / user.storage.total) * 100 : 0;
  const queryClient = useQueryClient();
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      await uploadFilesWithVirusScan(Array.from(files));
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch {
      // toast already shown by uploadFilesWithVirusScan
    }
  };

  return (
    <aside className={cn(
      "h-screen flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 flex-shrink-0",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-sidebar-border flex-shrink-0">
        <div className="w-7 h-7 rounded-lg nexus-mark flex items-center justify-center flex-shrink-0">
          <Cloud className="w-3.5 h-3.5 text-white" />
        </div>
        {!collapsed && <span className="ml-2.5 font-brand text-[1.15rem] leading-none tracking-wide">NexusStorage</span>}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {/* Upload button — super admins own no workspace storage */}
        {!isSuperAdmin && (!collapsed ? (
          <label
            className="w-full flex items-center gap-2.5 px-3 py-2 mb-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Upload className="w-4 h-4" />
            New Upload
            <input type="file" multiple className="hidden" onChange={event => upload(event.target.files)} />
          </label>
        ) : (
          <label
            className="w-full flex items-center justify-center p-2 mb-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <input type="file" multiple className="hidden" onChange={event => upload(event.target.files)} />
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
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Storage</span>
            <span className="font-medium">{formatBytes(user.storage.used)} / {formatBytes(user.storage.total)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${storePct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">{(100 - storePct).toFixed(0)}% free</p>
        </div>
      )}
    </aside>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({
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
                        {n.action} · {n.file_name}
                      </p>
                    ) : (
                      <p className="text-sm leading-snug text-muted-foreground">{String(n.action).replaceAll("_", " ")} {n.file_name}</p>
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
            <Avatar initials={user.name.split(" ").map(n => n[0]).join("")} size="sm" />
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
              <div className="p-3 border-b border-border">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <Badge variant={user.role === "admin" ? "warning" : "muted"} >{user.role}</Badge>
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

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, delta, deltaType, icon: Icon, iconColor }: {
  label: string; value: string; delta: string; deltaType: "up" | "down";
  icon: React.ElementType; iconColor: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: iconColor + "18" }}>
          <Icon className="w-4.5 h-4.5" style={{ color: iconColor }} />
        </div>
        <div className={cn("flex items-center gap-1 text-xs font-medium", deltaType === "up" ? "text-emerald-500" : "text-red-500")}>
          {deltaType === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {delta}
        </div>
      </div>
      <p className="font-display text-[1.85rem] tracking-tight">{value}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// ─── Dashboard View ───────────────────────────────────────────────────────────
function DashboardView({ user }: { user: UserProfile }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.get });
  const uploadFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    try {
      await uploadFilesWithVirusScan(files);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
    } catch {
      // toast already shown by uploadFilesWithVirusScan
    }
  }, [queryClient]);
  const drop = useExternalFileDrop(uploadFiles);

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
          <p className="text-xs text-muted-foreground mb-4">{formatByteCount(stats?.storage_used ?? 0)} used of {formatByteCount(stats?.storage_total ?? 0)}</p>
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
            {...drop.handlers}
            className={cn(
              "relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer mb-4 overflow-hidden",
              drop.active ? "border-primary bg-accent scale-[1.01] shadow-md" : "border-border hover:border-primary/40 hover:bg-accent/30"
            )}
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-colors", drop.active ? "bg-primary text-primary-foreground nexus-drop-pulse" : "bg-primary/10")}>
              <Upload className={cn("w-5 h-5", drop.active ? "text-primary-foreground" : "text-primary")} />
            </div>
            <p className="font-display text-xl">{drop.active ? "Drop to upload" : "Drop files to upload"}</p>
            <p className="font-hand text-sm text-muted-foreground mt-1.5">
              or{" "}
              <label className="text-primary hover:underline cursor-pointer font-sans text-xs font-medium tracking-normal">
                browse files
                <input type="file" multiple className="hidden" onChange={e => uploadFiles(Array.from(e.target.files || []))} />
              </label>
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
                  <p className="text-xs text-muted-foreground truncate">{log.file_name}</p>
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

// ─── Files View ───────────────────────────────────────────────────────────────
type FolderCrumb = { id: string; name: string };

function EncryptedAuditRow({
  log,
  compact = false,
}: {
  log: { id: string; user: string; action: string; file_name: string; timestamp: string; encrypted?: boolean; type?: string };
  compact?: boolean;
}) {
  const sealed = Boolean(log.encrypted) || String(log.action || "").startsWith("enc://");
  return (
    <div className={cn("flex gap-3 items-start", compact ? "px-4 py-3" : "px-4 py-3.5 items-center")}>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: (ACTIVITY_COLORS[log.type || ""] || BRAND.bark) + "18" }}
      >
        {sealed ? <Lock className="w-3.5 h-3.5 text-primary" /> : <Activity className="w-3.5 h-3.5 text-primary" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{log.user}</p>
        {sealed ? (
          <div className="mt-1 space-y-1">
            <p className="text-[11px] font-mono tracking-wide text-muted-foreground truncate flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-primary/80">action</span>
              {log.action}
            </p>
            <p className="text-[11px] font-mono tracking-wide text-muted-foreground truncate flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-primary/80">target</span>
              {log.file_name}
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground truncate">{String(log.action).replaceAll("_", " ")}</p>
            <p className="text-xs font-medium truncate">{log.file_name}</p>
          </>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground flex-shrink-0 pt-0.5">{new Date(log.timestamp).toLocaleString()}</span>
    </div>
  );
}

function FilesView() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileItem } | null>(null);
  const [sortBy, setSortBy] = useState("modified");
  const [filter, setFilter] = useState("all");
  const [shareTarget, setShareTarget] = useState<FileItem | null>(null);
  const [folderStack, setFolderStack] = useState<FolderCrumb[]>([]);
  const [dropTargetFolder, setDropTargetFolder] = useState<string | null>(null);
  const [draggingFileId, setDraggingFileId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const currentFolderId = folderStack.length ? folderStack[folderStack.length - 1].id : null;
  const parentParam: "root" | string = currentFolderId || "root";

  const { data: apiFiles = [], isLoading } = useQuery({
    queryKey: ["files", "mine", parentParam],
    queryFn: () => fileApi.list("mine", { parent: parentParam }),
  });
  const files = apiFiles.map(toUiFile);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["files"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const uploadFiles = useCallback(async (incoming: File[], intoFolderId?: string | null) => {
    if (!incoming.length) return;
    const parent = intoFolderId === undefined ? currentFolderId || undefined : intoFolderId || undefined;
    try {
      await uploadFilesWithVirusScan(incoming, parent);
      refresh();
    } catch {
      // toast already shown by uploadFilesWithVirusScan
    }
  }, [currentFolderId, queryClient]);

  const drop = useExternalFileDrop(uploadFiles);

  const openFolder = (folder: FileItem) => {
    if (folder.type !== "folder") return;
    setFolderStack(stack => [...stack, { id: folder.id, name: folder.name }]);
    setSelected(new Set());
    setFilter("all");
  };

  const goToCrumb = (index: number) => {
    setFolderStack(stack => (index < 0 ? [] : stack.slice(0, index + 1)));
    setSelected(new Set());
  };

  const moveFileToFolder = async (fileId: string, folderId: string | null) => {
    try {
      await fileApi.update(fileId, { parent: folderId });
      refresh();
      toast.success(folderId ? "Moved into folder" : "Moved to root");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Move failed");
    } finally {
      setDropTargetFolder(null);
      setDraggingFileId(null);
    }
  };

  useEffect(() => {
    const close = () => setContextMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const handleContext = (e: React.MouseEvent, file: FileItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const trashFiles = async (ids: string[]) => {
    try {
      await Promise.all(ids.map(id => fileApi.trash(id)));
      setSelected(new Set());
      refresh();
      toast.success("Moved to trash");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  };

  const downloadFiles = async (ids: string[]) => {
    try {
      for (const id of ids) {
        const file = files.find(item => item.id === id);
        if (file?.type !== "folder") await authenticatedDownload(id, file?.name || "download");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    }
  };

  const handleMenuAction = async (label: string, file: FileItem) => {
    setContextMenu(null);
    try {
      if (label === "Open") openFolder(file);
      else if (label === "Preview") await authenticatedPreview(file.id);
      else if (label === "Download") await authenticatedDownload(file.id, file.name);
      else if (label === "Star" || label === "Unstar") {
        await fileApi.update(file.id, { starred: !file.starred });
        refresh();
      } else if (label === "Share…") {
        setShareTarget(file);
      } else if (label === "Copy link") {
        const link = await fileApi.createShareLink(file.id, { permission: "view" });
        await navigator.clipboard.writeText(link.url);
        toast.success("Secure link copied");
      } else if (label === "Rename") {
        const name = window.prompt("New name", file.name)?.trim();
        if (name && name !== file.name) {
          await fileApi.update(file.id, { name });
          refresh();
        }
      } else if (label === "Duplicate") {
        await fileApi.duplicate(file.id);
        refresh();
        toast.success("Duplicated");
      } else if (label === "Move up") {
        const parentId = folderStack.length > 1 ? folderStack[folderStack.length - 2].id : null;
        await moveFileToFolder(file.id, parentId);
      } else if (label === "Move to…") {
        const folderName = window.prompt("Move to folder in this view (blank = root / parent)")?.trim();
        if (folderName !== undefined) {
          if (!folderName) {
            await moveFileToFolder(file.id, folderStack.length > 1 ? folderStack[folderStack.length - 2].id : null);
          } else {
            const folder = files.find(item => item.type === "folder" && item.name.toLowerCase() === folderName.toLowerCase());
            if (!folder) throw new Error("Folder not found in this location");
            await moveFileToFolder(file.id, folder.id);
          }
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `${label} failed`);
    }
  };

  const filtered = files
    .filter(f => filter === "all" || f.type === filter || (filter === "starred" && f.starred))
    .sort((a, b) => {
      if (a.type === "folder" && b.type !== "folder") return -1;
      if (b.type === "folder" && a.type !== "folder") return 1;
      return sortBy === "name" ? a.name.localeCompare(b.name) : b.modified.localeCompare(a.modified);
    });

  const bindDrag = (file: FileItem) => ({
    draggable: true as const,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(NEXUS_FILE_MIME, file.id);
      e.dataTransfer.effectAllowed = "move";
      setDraggingFileId(file.id);
    },
    onDragEnd: () => { setDraggingFileId(null); setDropTargetFolder(null); },
    onDragOver: (e: React.DragEvent) => {
      if (file.type !== "folder" || draggingFileId === file.id) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      setDropTargetFolder(file.id);
    },
    onDragLeave: () => {
      if (dropTargetFolder === file.id) setDropTargetFolder(null);
    },
    onDrop: async (e: React.DragEvent) => {
      if (file.type !== "folder") return;
      e.preventDefault();
      e.stopPropagation();
      const draggedId = e.dataTransfer.getData(NEXUS_FILE_MIME);
      if (draggedId && draggedId !== file.id) await moveFileToFolder(draggedId, file.id);
      else if (hasExternalFiles(e)) await uploadFiles(Array.from(e.dataTransfer.files), file.id);
      setDropTargetFolder(null);
    },
  });

  return (
    <div className="relative space-y-4" {...drop.handlers}>
      <DropOverlay active={drop.active} label={currentFolderId ? "Drop files into this folder" : "Drop files into My Files"} />

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-2xl">My Files</h2>
          <p className="font-hand text-sm text-muted-foreground mt-1">
            {currentFolderId ? `Inside ${folderStack[folderStack.length - 1].name}` : "Browse, organize, and upload"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const name = window.prompt("Folder name")?.trim();
              if (!name) return;
              try {
                await fileApi.createFolder(name, currentFolderId || undefined);
                refresh();
                toast.success("Folder created");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to create folder");
              }
            }}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-primary text-primary-foreground"
          >
            <Plus className="w-3.5 h-3.5" /> New folder
          </button>
          <label className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border bg-card hover:bg-secondary cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Upload
            <input type="file" multiple className="hidden" onChange={e => uploadFiles(Array.from(e.target.files || []))} />
          </label>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 flex-wrap text-sm bg-card border border-border rounded-xl px-3 py-2">
        <button
          onClick={() => goToCrumb(-1)}
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors",
            !folderStack.length ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          <Home className="w-3.5 h-3.5" /> Root
        </button>
        {folderStack.map((crumb, index) => (
          <div key={crumb.id} className="inline-flex items-center gap-1">
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
            <button
              onClick={() => goToCrumb(index)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors max-w-[160px]",
                index === folderStack.length - 1 ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{crumb.name}</span>
            </button>
          </div>
        ))}
        {folderStack.length > 0 && (
          <button
            onClick={() => goToCrumb(folderStack.length - 2)}
            className="ml-auto text-xs text-primary hover:underline px-2"
          >
            Up one level
          </button>
        )}
      </nav>

      <div
        className={cn(
          "rounded-xl border-2 border-dashed p-5 text-center transition-all",
          drop.active ? "border-primary bg-accent" : "border-border bg-card/60 hover:border-primary/35",
        )}
      >
        <p className="font-display text-lg">{drop.active ? "Release to upload here" : "Drag files into this folder"}</p>
        <p className="font-hand text-sm text-muted-foreground mt-1">
          Drop onto a subfolder to nest them · double-click a folder to open it
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
          {[
            { id: "all", label: "All" },
            { id: "folder", label: "Folders" },
            { id: "image", label: "Images" },
            { id: "document", label: "Docs" },
            { id: "starred", label: "Starred" },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn("px-3 py-1.5 text-xs rounded-md font-medium transition-colors", filter === f.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {selected.size > 0 && (
            <div className="flex items-center gap-1 mr-2">
              <span className="text-xs text-muted-foreground">{selected.size} selected</span>
              <button onClick={() => downloadFiles([...selected])} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Download"><Download className="w-3.5 h-3.5" /></button>
              <button onClick={() => trashFiles([...selected])} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-red-500" title="Delete"><Trash className="w-3.5 h-3.5" /></button>
              <button onClick={() => setSelected(new Set())} className="p-1.5 rounded-lg hover:bg-secondary transition-colors"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-card">
            <option value="modified">Recently modified</option><option value="name">Name</option>
          </select>
          <button onClick={() => setViewMode("grid")} className={cn("p-2 rounded-lg transition-colors", viewMode === "grid" ? "bg-secondary" : "hover:bg-secondary")}>
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode("list")} className={cn("p-2 rounded-lg transition-colors", viewMode === "list" ? "bg-secondary" : "hover:bg-secondary")}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading files…</div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-border rounded-2xl bg-card/40">
          <FolderOpen className="w-10 h-10 text-muted-foreground/35 mx-auto mb-3" />
          <p className="font-display text-xl">This folder is empty</p>
          <p className="font-hand text-sm text-muted-foreground mt-1">Upload files or create a subfolder to get started</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map(file => (
            <div
              key={file.id}
              {...bindDrag(file)}
              onContextMenu={e => handleContext(e, file)}
              onClick={() => toggleSelect(file.id)}
              onDoubleClick={() => (file.type === "folder" ? openFolder(file) : authenticatedPreview(file.id).catch(err => toast.error(err.message)))}
              className={cn(
                "bg-card border rounded-xl p-4 cursor-pointer group relative transition-all duration-150 hover:shadow-md",
                selected.has(file.id) ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/30",
                draggingFileId === file.id && "opacity-50",
                dropTargetFolder === file.id && "border-primary bg-accent ring-2 ring-primary/25 scale-[1.02]",
              )}
            >
              {selected.has(file.id) && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: file.color + "18" }}>
                {getFileIcon(file.type, file.color)}
              </div>
              <p className="text-xs font-medium truncate mb-1">{file.name}</p>
              <p className="text-[10px] text-muted-foreground">{file.type === "folder" ? "Folder · double-click to open" : file.modified}</p>
              <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                {file.starred && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                {file.shared && <Share2 className="w-3 h-3 text-primary" />}
              </div>
              {dropTargetFolder === file.id && (
                <p className="absolute inset-x-2 bottom-2 rounded-md bg-primary/90 px-2 py-1 text-[10px] font-medium text-primary-foreground">
                  Drop to move here
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden sm:table-cell">Size</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden md:table-cell">Modified</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden lg:table-cell">Owner</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(file => (
                <tr
                  key={file.id}
                  {...bindDrag(file)}
                  onContextMenu={e => handleContext(e, file)}
                  onClick={() => toggleSelect(file.id)}
                  onDoubleClick={() => (file.type === "folder" ? openFolder(file) : authenticatedPreview(file.id).catch(err => toast.error(err.message)))}
                  className={cn(
                    "cursor-pointer transition-colors",
                    selected.has(file.id) ? "bg-accent/50" : "hover:bg-secondary/50",
                    draggingFileId === file.id && "opacity-50",
                    dropTargetFolder === file.id && "bg-accent ring-1 ring-inset ring-primary/40",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: file.color + "18" }}>
                        {getFileIcon(file.type, file.color)}
                      </div>
                      <span className="text-sm font-medium truncate max-w-[180px]">{file.name}</span>
                      {file.starred && <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
                      {file.shared && <Share2 className="w-3 h-3 text-primary flex-shrink-0" />}
                      {dropTargetFolder === file.id && <span className="text-[10px] text-primary font-medium">Drop here</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">{file.type === "folder" ? "—" : file.size}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{file.modified}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">{file.owner}</td>
                  <td className="px-4 py-3">
                    {file.type === "folder" ? (
                      <button
                        onClick={e => { e.stopPropagation(); openFolder(file); }}
                        className="p-1 rounded-lg hover:bg-secondary transition-colors"
                        title="Open folder"
                      >
                        <FolderOpen className="w-4 h-4 text-primary" />
                      </button>
                    ) : (
                      <button className="p-1 rounded-lg hover:bg-secondary transition-colors">
                        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {contextMenu && (
        <div
          className="fixed z-50 w-48 bg-popover border border-border rounded-xl shadow-xl overflow-hidden py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          {[
            ...(contextMenu.file.type === "folder" ? [{ icon: FolderOpen, label: "Open" }] : [{ icon: Eye, label: "Preview" }]),
            { icon: Download, label: "Download" },
            { icon: Share2, label: "Share…" },
            { icon: Link, label: "Copy link" },
            { icon: FileText, label: "Rename" },
            { icon: Star, label: contextMenu.file.starred ? "Unstar" : "Star" },
            { icon: Copy, label: "Duplicate" },
            { icon: Move, label: "Move to…" },
            ...(folderStack.length ? [{ icon: ArrowUpRight, label: "Move up" }] : []),
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              onClick={() => handleMenuAction(label, contextMenu.file)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-secondary transition-colors"
            >
              <Icon className="w-3.5 h-3.5 text-muted-foreground" />
              {label}
            </button>
          ))}
          <div className="border-t border-border mt-1 pt-1">
            <button
              onClick={() => { setContextMenu(null); trashFiles([contextMenu.file.id]); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <Trash className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>
      )}

      {shareTarget && <ShareDialog file={shareTarget} onClose={() => setShareTarget(null)} />}
    </div>
  );
}

// ─── Reusable Share Dialog ──────────────────────────────────────────────────
// Used from both the Files page and the Shared page. Supports sharing with a
// person by email (which sends them a notification email) and generating a
// secure public link that can optionally be emailed to a recipient.
function ShareDialog({ file, onClose }: { file: { id: string; name: string }; onClose: () => void }) {
  const [shareEmail, setShareEmail] = useState("");
  const [permission, setPermission] = useState<"view" | "edit" | "share">("view");
  const [expiration, setExpiration] = useState("");
  const [sharePassword, setSharePassword] = useState("");
  const [linkEmail, setLinkEmail] = useState("");
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [busy, setBusy] = useState<"invite" | "link" | null>(null);

  const invitePerson = async () => {
    if (!shareEmail.trim()) return toast.error("Enter an email address");
    setBusy("invite");
    try {
      const result = await fileApi.invite(file.id, shareEmail.trim(), permission);
      toast.success(
        result.email_sent
          ? `Share request sent to ${shareEmail} — they must accept it`
          : `Share request created for ${shareEmail} — waiting for acceptance`,
      );
      setShareEmail("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sharing failed");
    } finally {
      setBusy(null);
    }
  };

  const createLink = async (copy: boolean) => {
    setBusy("link");
    try {
      const link = await fileApi.createShareLink(file.id, {
        permission,
        expires_at: expiration ? new Date(expiration).toISOString() : null,
        password: sharePassword,
        email: linkEmail.trim() || undefined,
      });
      setCreatedLink(link.url);
      if (copy) await navigator.clipboard.writeText(link.url);
      toast.success(
        link.email_sent
          ? `Secure link emailed to ${linkEmail.trim()}`
          : copy
            ? "Secure link created and copied"
            : "Secure link created",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create link");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-popover border border-border rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold truncate max-w-[20rem]">Share "{file.name}"</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Invite people or create a secure link</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Invite a person by email */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Share with a person (by email)</label>
            <div className="flex gap-2">
              <input value={shareEmail} onChange={e => setShareEmail(e.target.value)} placeholder="name@company.com" className="flex-1 text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
              <select value={permission} onChange={e => setPermission(e.target.value as typeof permission)} className="text-xs px-2 py-2 rounded-lg bg-secondary border border-border focus:outline-none">
                <option value="view">Can view</option>
                <option value="edit">Can edit</option>
                <option value="share">Can share</option>
              </select>
              <button onClick={invitePerson} disabled={busy === "invite"} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1">
                {busy === "invite" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />} Send
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">The person receives an email notification and can open it after signing in.</p>
          </div>

          {/* Secure link options */}
          <div className="pt-1 border-t border-border space-y-3">
            <label className="text-xs font-medium text-muted-foreground block">Secure link</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[11px] text-muted-foreground">Expires on</span>
                <input type="date" value={expiration} onChange={e => setExpiration(e.target.value)} className="w-full mt-1 text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">Password (optional)</span>
                <input type="password" value={sharePassword} onChange={e => setSharePassword(e.target.value)} placeholder="Protect the link" className="w-full mt-1 text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
              </div>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground">Email this link to (optional)</span>
              <input value={linkEmail} onChange={e => setLinkEmail(e.target.value)} placeholder="name@company.com" className="w-full mt-1 text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
            </div>
            {createdLink && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary text-xs">
                <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate flex-1">{createdLink}</span>
                <button onClick={() => { navigator.clipboard.writeText(createdLink); toast.success("Copied"); }} className="p-1 rounded hover:bg-background">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => createLink(true)} disabled={busy === "link"} className="flex-1 px-3 py-2 rounded-lg bg-secondary text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5">
                {busy === "link" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link className="w-3 h-3" />} Create &amp; copy link
              </button>
              {linkEmail.trim() && (
                <button onClick={() => createLink(false)} disabled={busy === "link"} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> Email link
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg hover:bg-secondary transition-colors">Done</button>
        </div>
      </div>
    </div>
  );
}

// ─── Two-Factor (Google Authenticator) Setup Dialog ──────────────────────────
function TwoFactorDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<"password" | "scan">("password");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [setup, setSetup] = useState<{ secret: string; provisioning_uri: string; qr_code: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const startSetup = async () => {
    if (!password) return toast.error("Enter your password");
    setBusy(true);
    try {
      setSetup(await authApi.setupTwoFactor(password));
      setOtp("");
      setStep("scan");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start setup");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    const code = otp.replace(/\D/g, "");
    if (code.length !== 6) return toast.error("Enter the 6-digit code from your authenticator");
    setBusy(true);
    try {
      await authApi.confirmTwoFactor(code);
      toast.success("Two-factor authentication enabled");
      onDone();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid code");
      setOtp("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-popover border border-border rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Set up Google Authenticator</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {step === "password" ? (
            <>
              <p className="text-sm text-muted-foreground">Confirm your password to generate a secret for your authenticator app.</p>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && startSetup()} placeholder="Your password" className="w-full text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
              <button onClick={startSetup} disabled={busy} className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Continue
              </button>
            </>
          ) : (
            <>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal pl-4">
                <li>Remove any previous NexusStorage entry from your authenticator app.</li>
                <li>Scan the QR code (or enter the key manually).</li>
                <li>Enter the current 6-digit code — it changes every 30 seconds.</li>
              </ol>
              {setup?.qr_code && (
                <div className="flex justify-center">
                  <img src={setup.qr_code} alt="Authenticator QR code" className="w-44 h-44 rounded-lg border border-border bg-white p-2" />
                </div>
              )}
              <div className="text-center space-y-1.5">
                <p className="text-[11px] text-muted-foreground">Can't scan? Enter this key manually:</p>
                <code className="block text-xs font-mono break-all bg-secondary rounded-lg px-3 py-2">{setup?.secret}</code>
                <button
                  type="button"
                  onClick={() => { if (setup?.secret) { navigator.clipboard.writeText(setup.secret); toast.success("Key copied"); } }}
                  className="text-xs text-primary hover:underline"
                >
                  Copy key
                </button>
              </div>
              <input
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={e => e.key === "Enter" && otp.length === 6 && confirm()}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="w-full text-center tracking-[0.4em] text-lg px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50"
              />
              <button onClick={confirm} disabled={busy || otp.length !== 6} className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Verify &amp; enable
              </button>
              <button type="button" onClick={startSetup} disabled={busy} className="w-full text-xs text-muted-foreground hover:text-foreground">
                QR not working? Generate a new code
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Profile View ─────────────────────────────────────────────────────────────
function ProfileView({ user, onUserUpdate }: { user: UserProfile; onUserUpdate: (user: ApiUser) => void }) {
  const [name, setName] = useState(user.name);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const storePct = user.storage.total ? Math.min(100, (user.storage.used / user.storage.total) * 100) : 0;

  const saveName = async () => {
    if (!name.trim() || name.trim() === user.name) return;
    setSavingName(true);
    try {
      onUserUpdate(await authApi.updateProfile({ name: name.trim() }));
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = async () => {
    const current = window.prompt("Current password");
    if (!current) return;
    const next = window.prompt("New password (minimum 8 characters)");
    if (!next) return;
    try {
      await authApi.changePassword(current, next);
      toast.success("Password changed — please sign in again");
      clearTokens();
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change password");
    }
  };

  const disableTwoFactor = async () => {
    const password = window.prompt("Enter your password to disable two-factor authentication");
    if (!password) return;
    const otp = window.prompt("Enter the current 6-digit code from your authenticator app");
    if (!otp) return;
    try {
      await authApi.disableTwoFactor(password, otp.replace(/\D/g, ""));
      onUserUpdate(await authApi.me());
      toast.success("Two-factor authentication disabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disable 2FA");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account, security and storage</p>
      </div>

      {/* Identity card */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-4">
          <Avatar initials={user.name.split(" ").map(n => n[0]).join("")} size="lg" />
          <div className="min-w-0">
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <Badge variant={user.role === "admin" ? "warning" : "muted"}>{user.role}</Badge>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Display name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
          </div>
          <button onClick={saveName} disabled={savingName} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
            {savingName && <Loader2 className="w-4 h-4 animate-spin" />} Save
          </button>
        </div>
      </div>

      {/* Security card */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <h3 className="font-medium">Security</h3>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            {user.twoFactorEnabled
              ? <ShieldCheck className="w-5 h-5 text-emerald-500" />
              : <ShieldAlert className="w-5 h-5 text-amber-500" />}
            <div>
              <p className="text-sm font-medium">Two-factor authentication (Google Authenticator)</p>
              <p className="text-xs text-muted-foreground">
                {user.twoFactorEnabled ? "Enabled — codes required at sign-in" : "Add a second layer of protection with a TOTP app"}
                {user.twoFactorRequired && !user.twoFactorEnabled && " · required by your organization"}
              </p>
            </div>
          </div>
          {user.twoFactorEnabled
            ? <button onClick={disableTwoFactor} className="px-3 py-2 rounded-lg bg-secondary text-xs font-medium hover:bg-red-500 hover:text-white transition-colors">Disable</button>
            : <button onClick={() => setTwoFactorOpen(true)} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"><QrCode className="w-3.5 h-3.5" /> Enable</button>}
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap border-t border-border pt-4">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-muted-foreground">Change your account password</p>
            </div>
          </div>
          <button onClick={changePassword} className="px-3 py-2 rounded-lg bg-secondary text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors">Change</button>
        </div>
      </div>

      {/* Storage card */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <HardDrive className="w-4 h-4 text-primary" />
          <h3 className="font-medium">Storage</h3>
        </div>
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-muted-foreground">Used</span>
          <span className="font-medium">{formatBytes(user.storage.used)} / {formatBytes(user.storage.total)}</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${storePct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{(100 - storePct).toFixed(0)}% free</p>
      </div>

      {twoFactorOpen && (
        <TwoFactorDialog onClose={() => setTwoFactorOpen(false)} onDone={async () => onUserUpdate(await authApi.me())} />
      )}
    </div>
  );
}

function SharedView() {
  const [tab, setTab] = useState<"accepted" | "pending" | "sent">("accepted");
  const [shareModal, setShareModal] = useState<FileItem | null>(null);
  const queryClient = useQueryClient();
  const { data: acceptedFiles = [] } = useQuery({
    queryKey: ["files", "shared"],
    queryFn: () => fileApi.list("shared"),
  });
  const { data: pending = [] } = useQuery({
    queryKey: ["shares", "pending"],
    queryFn: () => fileApi.shareRequests("pending"),
  });
  const { data: acceptedShares = [] } = useQuery({
    queryKey: ["shares", "accepted"],
    queryFn: () => fileApi.shareRequests("accepted"),
  });
  const { data: allShares = [] } = useQuery({
    queryKey: ["shares", "sent"],
    queryFn: () => fileApi.shareRequests(undefined, "sent"),
    enabled: tab === "sent",
  });

  const refreshShares = () => {
    queryClient.invalidateQueries({ queryKey: ["shares"] });
    queryClient.invalidateQueries({ queryKey: ["files", "shared"] });
  };

  const respond = async (id: string, action: "accept" | "ignore" | "revoke") => {
    try {
      if (action === "accept") await fileApi.acceptShare(id);
      else if (action === "ignore") await fileApi.ignoreShare(id);
      else await fileApi.revokeShare(id);
      refreshShares();
      toast.success(
        action === "accept" ? "Share accepted — you can preview and download" :
        action === "ignore" ? "Share request ignored" :
        "Share access removed",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update share");
    }
  };

  const files = acceptedFiles.map(toUiFile);
  const sentByMe = allShares.filter(s => s.status === "pending" || s.status === "accepted");

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold">Shared Items</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Accept share requests, then preview or download documents</p>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          {([
            ["accepted", "Shared with me"],
            ["pending", `Pending${pending.length ? ` (${pending.length})` : ""}`],
            ["sent", "Shared by me"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn("px-3 py-1.5 transition-colors", tab === id ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "pending" && (
        <div className="grid gap-3">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">No pending share requests</p>
          ) : pending.map(share => (
            <div key={share.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 flex-wrap">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND.brick + "18" }}>
                {getFileIcon((share.file_type as FileType) || "document", BRAND.brick)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{share.file_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  From {share.sender_name} · {share.permission} access · {new Date(share.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => respond(share.id, "accept")} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90">Accept</button>
                <button onClick={() => respond(share.id, "ignore")} className="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted">Ignore</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "accepted" && (
        <div className="grid gap-3">
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">No accepted shared files yet</p>
          ) : files.map(file => {
            const grant = acceptedShares.find(s => s.file_id === file.id);
            return (
              <div key={file.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-colors group">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: file.color + "18" }}>
                  {getFileIcon(file.type, file.color)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Shared by {file.owner} · {file.modified}</p>
                </div>
                <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  {file.type !== "folder" && (
                    <>
                      <button onClick={() => authenticatedPreview(file.id).catch(error => toast.error(error.message))} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">
                        <Eye className="w-3 h-3" /> Preview
                      </button>
                      <button onClick={() => authenticatedDownload(file.id, file.name).catch(error => toast.error(error.message))} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">
                        <Download className="w-3 h-3" /> Download
                      </button>
                    </>
                  )}
                  {grant && (
                    <button onClick={() => respond(grant.id, "revoke")} className="text-xs px-2.5 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors">
                      Unaccept
                    </button>
                  )}
                  <button onClick={() => setShareModal(file)} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">
                    <Share2 className="w-3 h-3" /> Manage
                  </button>
                </div>
                <Badge variant="muted">{file.type}</Badge>
              </div>
            );
          })}
        </div>
      )}

      {tab === "sent" && (
        <div className="grid gap-3">
          {sentByMe.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">You have not shared any items yet</p>
          ) : sentByMe.map(share => (
            <div key={share.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND.ember + "18" }}>
                {getFileIcon((share.file_type as FileType) || "document", BRAND.ember)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{share.file_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  To {share.recipient_email} · {share.permission} · {share.status}
                </p>
              </div>
              <Badge variant={share.status === "accepted" ? "warning" : "muted"}>{share.status}</Badge>
              {(share.status === "pending" || share.status === "accepted") && (
                <button onClick={() => respond(share.id, "revoke")} className="text-xs px-2.5 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10">
                  Withdraw
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {shareModal && <ShareDialog file={shareModal} onClose={() => setShareModal(null)} />}
    </div>
  );
}

// ─── Trash View ───────────────────────────────────────────────────────────────
function TrashView() {
  const queryClient = useQueryClient();
  const { data: apiTrash = [] } = useQuery({ queryKey: ["files", "trash"], queryFn: () => fileApi.list("trash") });
  const trash = apiTrash.map(file => ({ ...toUiFile(file), deleted: file.deleted_at ? new Date(file.deleted_at).toLocaleString() : "" }));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["files"] });
  const restore = async (id: string) => {
    try { await fileApi.restore(id); refresh(); toast.success("Restored"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Restore failed"); }
  };
  const permanentlyDelete = async (id: string) => {
    try { await fileApi.permanentDelete(id); refresh(); toast.success("Permanently deleted"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Delete failed"); }
  };
  const emptyTrash = async () => {
    try { await fileApi.emptyTrash(); refresh(); toast.success("Trash emptied"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to empty trash"); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-semibold">Trash</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Items are deleted permanently after 30 days</p>
        </div>
        <button onClick={emptyTrash} className="text-xs text-red-500 hover:underline flex items-center gap-1">
          <Trash2 className="w-3.5 h-3.5" /> Empty trash
        </button>
      </div>

      {trash.length === 0 ? (
        <div className="text-center py-24">
          <Trash2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Trash is empty</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {trash.map((f, i) => (
            <div key={f.id} className={cn("flex items-center gap-4 px-4 py-3 hover:bg-secondary/50 transition-colors", i !== trash.length - 1 && "border-b border-border")}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: f.color + "18" }}>
                {getFileIcon(f.type, f.color)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground">Deleted {f.deleted}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => restore(f.id)} className="text-xs px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">Restore</button>
                <button onClick={() => permanentlyDelete(f.id)} className="text-xs px-2.5 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Super Admin: Workspaces ─────────────────────────────────────────────────
function WorkspacesView() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", admin_name: "", admin_email: "", admin_password: "" });
  const { data: overview } = useQuery({ queryKey: ["system", "overview"], queryFn: superAdminApi.overview });
  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ["system", "workspaces"],
    queryFn: superAdminApi.workspaces,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["system"] });

  const createWorkspace = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await superAdminApi.createWorkspace({
        name: form.name.trim(),
        admin_name: form.admin_name.trim() || undefined,
        admin_email: form.admin_email.trim() || undefined,
        admin_password: form.admin_password || undefined,
      });
      setForm({ name: "", admin_name: "", admin_email: "", admin_password: "" });
      setCreating(false);
      refresh();
      toast.success("Workspace created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create workspace");
    }
  };

  const toggleActive = async (workspace: Workspace) => {
    try {
      await superAdminApi.updateWorkspace(workspace.id, { is_active: !workspace.is_active });
      refresh();
      toast.success(`${workspace.name} ${workspace.is_active ? "suspended" : "reactivated"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  };

  const removeWorkspace = async (workspace: Workspace) => {
    const confirmation = window.prompt(`Type "${workspace.name}" to permanently delete this workspace and all its files`);
    if (confirmation !== workspace.name) return;
    try {
      await superAdminApi.deleteWorkspace(workspace.id);
      refresh();
      toast.success("Workspace deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold">Workspaces</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Every organization in the system</p>
        </div>
        <button onClick={() => setCreating(v => !v)} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> New workspace
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Workspaces" value={String(overview?.workspaces ?? 0)} delta="total" deltaType="up" icon={Building2} iconColor={BRAND.brick} />
        <StatCard label="Suspended" value={String(overview?.suspended_workspaces ?? 0)} delta="live" deltaType="down" icon={ShieldAlert} iconColor={BRAND.maroon} />
        <StatCard label="Administrators" value={String(overview?.admins ?? 0)} delta="all tenants" deltaType="up" icon={Crown} iconColor={BRAND.ember} />
        <StatCard label="Total Storage" value={formatByteCount(overview?.storage_used ?? 0)} delta="live" deltaType="up" icon={Database} iconColor={BRAND.clay} />
      </div>

      {creating && (
        <form onSubmit={createWorkspace} className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="font-medium text-sm">Create workspace</h3>
          <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Workspace name" className="w-full text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
          <p className="text-xs text-muted-foreground">Optionally create its first administrator now.</p>
          <div className="grid sm:grid-cols-3 gap-2">
            <input value={form.admin_name} onChange={e => setForm({ ...form, admin_name: e.target.value })} placeholder="Admin name" className="text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
            <input type="email" value={form.admin_email} onChange={e => setForm({ ...form, admin_email: e.target.value })} placeholder="Admin email" className="text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
            <input type="password" value={form.admin_password} onChange={e => setForm({ ...form, admin_password: e.target.value })} placeholder="Temp password" className="text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreating(false)} className="px-3 py-2 text-sm rounded-lg hover:bg-secondary">Cancel</button>
            <button type="submit" className="px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90">Create</button>
          </div>
        </form>
      )}

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Loading workspaces…</p>
        ) : workspaces.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">No workspaces yet</p>
        ) : workspaces.map((workspace, index) => (
          <div key={workspace.id} className={cn("flex items-center gap-4 px-4 py-3.5 flex-wrap", index !== workspaces.length - 1 && "border-b border-border")}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND.brick + "18" }}>
              <Building2 className="w-4 h-4" style={{ color: BRAND.brick }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{workspace.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {workspace.slug} · {workspace.user_count} users · {workspace.admin_count} admins · {formatByteCount(workspace.storage_used || 0)}
              </p>
            </div>
            <Badge variant={workspace.is_active ? "success" : "danger"}>{workspace.is_active ? "active" : "suspended"}</Badge>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleActive(workspace)} className="text-xs px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">
                {workspace.is_active ? "Suspend" : "Reactivate"}
              </button>
              <button onClick={() => removeWorkspace(workspace)} className="text-xs px-2.5 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Super Admin: Administrators ─────────────────────────────────────────────
function AdministratorsView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", organization: "" });
  const { data: workspaces = [] } = useQuery({ queryKey: ["system", "workspaces"], queryFn: superAdminApi.workspaces });
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["system", "users"],
    queryFn: () => superAdminApi.users(),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["system"] });
  const filtered = accounts.filter(account =>
    `${account.name} ${account.email} ${account.organization_name || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const createAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await superAdminApi.createAdmin({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        organization: form.organization,
        role: "admin",
      });
      setForm({ name: "", email: "", password: "", organization: "" });
      setCreating(false);
      refresh();
      toast.success("Administrator created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create administrator");
    }
  };

  const update = async (account: SystemUser, changes: { role?: "admin" | "user"; is_active?: boolean }) => {
    try {
      await superAdminApi.updateUser(account.id, changes);
      refresh();
      toast.success(`${account.name} updated`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  };

  const resetPassword = async (account: SystemUser) => {
    const password = window.prompt(`New password for ${account.email} (minimum 8 characters)`);
    if (!password) return;
    try {
      await superAdminApi.updateUser(account.id, { password });
      toast.success("Password reset");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reset failed");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold">Administrators &amp; members</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Accounts across every workspace</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email or workspace…" className="text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
          <button onClick={() => setCreating(v => !v)} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
            <UserPlus className="w-4 h-4" /> New admin
          </button>
        </div>
      </div>

      {creating && (
        <form onSubmit={createAdmin} className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="font-medium text-sm">Create workspace administrator</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
            <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" className="text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
            <input required type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Temporary password" className="text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
            <select required value={form.organization} onChange={e => setForm({ ...form, organization: e.target.value })} className="text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none">
              <option value="">Select workspace…</option>
              {workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreating(false)} className="px-3 py-2 text-sm rounded-lg hover:bg-secondary">Cancel</button>
            <button type="submit" className="px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90">Create</button>
          </div>
        </form>
      )}

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Loading accounts…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">No matching accounts</p>
        ) : filtered.map((account, index) => (
          <div key={account.id} className={cn("flex items-center gap-4 px-4 py-3.5 flex-wrap", index !== filtered.length - 1 && "border-b border-border")}>
            <Avatar initials={account.name.split(" ").map(part => part[0]).join("").slice(0, 2)} color={AVATAR_COLORS[index % AVATAR_COLORS.length]} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{account.name}</p>
              <p className="text-xs text-muted-foreground truncate">{account.email} · {account.organization_name || "no workspace"}</p>
            </div>
            <Badge variant={account.role === "admin" ? "warning" : "muted"}>{account.role}</Badge>
            <Badge variant={account.is_active ? "success" : "danger"}>{account.is_active ? "active" : "suspended"}</Badge>
            <div className="flex items-center gap-2">
              <button onClick={() => update(account, { role: account.role === "admin" ? "user" : "admin" })} className="text-xs px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">
                {account.role === "admin" ? "Demote" : "Promote"}
              </button>
              <button onClick={() => update(account, { is_active: !account.is_active })} className="text-xs px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">
                {account.is_active ? "Suspend" : "Activate"}
              </button>
              <button onClick={() => resetPassword(account)} className="text-xs px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">
                Reset password
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Admin Analytics ──────────────────────────────────────────────────────────
function AdminAnalytics() {
  const { data } = useQuery({ queryKey: ["admin", "analytics"], queryFn: dashboardApi.admin });
  const recentActivity = data?.recent_activity || [];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={String(data?.total_users ?? 0)} delta="live" deltaType="up" icon={Users} iconColor={BRAND.brick} />
        <StatCard label="Active Today" value={String(data?.active_today ?? 0)} delta="live" deltaType="up" icon={Activity} iconColor={BRAND.ember} />
        <StatCard label="Total Storage" value={formatByteCount(data?.total_storage ?? 0)} delta="live" deltaType="up" icon={Database} iconColor={BRAND.clay} />
        <StatCard label="API Calls" value={String(data?.api_calls ?? 0)} delta="30d" deltaType="down" icon={Cpu} iconColor={BRAND.maroon} />
      </div>

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
                <p className="text-xs text-muted-foreground truncate mt-0.5">{log.file_name || "—"}</p>
              </div>
              <p className="text-[10px] text-muted-foreground whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── User Management ──────────────────────────────────────────────────────────
function UserManagement() {
  const [search, setSearch] = useState("");
  const colors = AVATAR_COLORS;
  const queryClient = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: ["admin", "users"], queryFn: adminApi.users });

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );
  const toggleUser = async (user: ApiUser) => {
    try {
      await adminApi.updateUser(user.id, { is_active: !user.is_active });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(`${user.name} ${user.is_active ? "suspended" : "activated"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "User update failed");
    }
  };
  const inviteUser = async () => {
    const email = window.prompt("Email address to invite")?.trim();
    if (!email) return;
    try {
      const invitation = await adminApi.invite(email);
      await navigator.clipboard.writeText(invitation.invite_url);
      toast.success("Invitation link copied (valid for 7 days)");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invitation failed");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold">User Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{users.length} users total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users…"
              className="pl-9 pr-4 py-2 text-sm rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50 w-52"
            />
          </div>
          <button onClick={inviteUser} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
            <UserPlus className="w-3.5 h-3.5" /> Invite
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">User</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden sm:table-cell">Role</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden md:table-cell">Storage</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden lg:table-cell">Joined</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((u, i) => (
              <tr key={u.id} className="hover:bg-secondary/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar initials={u.name.split(" ").map(part => part[0]).join("").slice(0, 2)} size="sm" color={colors[i % colors.length]} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <Badge variant={u.role === "admin" ? "warning" : "muted"}>{u.role}</Badge>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{formatByteCount(u.storage_used)}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">{new Date(u.date_joined).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <Badge variant={u.is_active ? "success" : "danger"}>{u.is_active ? "active" : "suspended"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleUser(u)}
                    title={u.is_active ? "Suspend user" : "Activate user"}
                    className="p-1 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── System Settings ──────────────────────────────────────────────────────────
function SystemSettings() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["admin", "settings"], queryFn: adminApi.settings });
  const [organizationName, setOrganizationName] = useState("");
  const [storageLimit, setStorageLimit] = useState(100);
  const [maxFileSize, setMaxFileSize] = useState(500);
  useEffect(() => {
    if (!settings) return;
    setOrganizationName(settings.name);
    setStorageLimit(settings.storage_quota_bytes / 1024 ** 3);
    setMaxFileSize(settings.max_file_size_bytes / 1024 ** 2);
  }, [settings]);
  const toggles = {
    twoFactor: settings?.require_two_factor ?? false,
    auditLog: settings?.audit_logging ?? false,
    autoBackup: settings?.automatic_backups ?? false,
    emailNotifs: settings?.email_notifications ?? false,
    apiAccess: settings?.api_access ?? false,
    maintenanceMode: settings?.maintenance_mode ?? false,
    selfRegistration: settings?.allow_self_registration ?? true,
  };
  const fieldMap: Record<keyof typeof toggles, keyof OrganizationSettings> = {
    twoFactor: "require_two_factor", auditLog: "audit_logging", autoBackup: "automatic_backups",
    emailNotifs: "email_notifications", apiAccess: "api_access", maintenanceMode: "maintenance_mode",
    selfRegistration: "allow_self_registration",
  };
  const toggle = async (key: keyof typeof toggles, label: string) => {
    try {
      const nextValue = !toggles[key];
      const updated = await adminApi.updateSettings({ [fieldMap[key]]: nextValue });
      queryClient.setQueryData(["admin", "settings"], updated);
      toast.success(
        key === "selfRegistration"
          ? (nextValue
            ? "Users can join with your organization slug"
            : "Self-registration is off — only invite links work")
          : `${label} ${nextValue ? "enabled" : "disabled"}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Settings update failed");
    }
  };
  const saveGeneral = async () => {
    try {
      await adminApi.updateSettings({
        name: organizationName,
        storage_quota_bytes: Math.round(storageLimit * 1024 ** 3),
        max_file_size_bytes: Math.round(maxFileSize * 1024 ** 2),
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      toast.success("Settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Settings update failed");
    }
  };
  const clearOrganizationData = async () => {
    const confirmation = window.prompt(`Type "${organizationName}" to clear all files, activity, and chats`);
    if (confirmation !== organizationName) {
      if (confirmation !== null) toast.error("Organization name did not match");
      return;
    }
    const password = window.prompt("Enter your account password to confirm");
    if (!password) return;
    try {
      await adminApi.clearOrganizationData(confirmation, password);
      queryClient.clear();
      toast.success("Organization data cleared");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to clear organization data");
    }
  };

  const ToggleRow = ({ id, label, desc }: { id: keyof typeof toggles; label: string; desc: string }) => (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => toggle(id, label)}
        className={cn("relative w-10 h-5 rounded-full transition-colors", toggles[id] ? "bg-primary" : "bg-secondary")}
      >
        <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", toggles[id] && "translate-x-5")} />
      </button>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-semibold">System Settings</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Configure your NexusStorage instance</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold mb-1">General</h3>
        <p className="text-xs text-muted-foreground mb-4">Basic system configuration</p>
        <div className="space-y-4">
          <div><label className="text-xs font-medium text-muted-foreground block mb-1.5">Organization name</label><input value={organizationName} onChange={e => setOrganizationName(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg bg-secondary border border-border" /></div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Organization slug</label>
            <div className="flex gap-2">
              <input readOnly value={settings?.slug || ""} className="flex-1 text-sm px-3 py-2 rounded-lg bg-secondary border border-border" />
              <button type="button" onClick={() => { if (settings?.slug) { navigator.clipboard.writeText(settings.slug); toast.success("Slug copied"); } }} className="text-xs px-3 py-2 rounded-lg bg-primary text-primary-foreground">Copy</button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Users need this slug to create a regular account in your workspace.</p>
          </div>
          <div><label className="text-xs font-medium text-muted-foreground block mb-1.5">Organization storage limit (GB)</label><input type="number" value={storageLimit} onChange={e => setStorageLimit(Number(e.target.value))} className="w-full text-sm px-3 py-2 rounded-lg bg-secondary border border-border" /></div>
          <div><label className="text-xs font-medium text-muted-foreground block mb-1.5">Max file size (MB)</label><input type="number" value={maxFileSize} onChange={e => setMaxFileSize(Number(e.target.value))} className="w-full text-sm px-3 py-2 rounded-lg bg-secondary border border-border" /></div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold mb-1">Security & Access</h3>
        <p className="text-xs text-muted-foreground mb-4">Authentication and access control settings</p>
        <ToggleRow id="twoFactor" label="Two-factor authentication" desc="Ask users to enable 2FA (you must enable it on your account first)" />
        <ToggleRow id="selfRegistration" label="Allow user self-registration" desc="When off, people can only join through an invite link — the organization slug alone will be rejected" />
        <ToggleRow id="auditLog" label="Audit logging" desc="Log all user actions for compliance" />
        <ToggleRow id="apiAccess" label="API access" desc="Allow API key generation" />
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold mb-1">Notifications & Backup</h3>
        <p className="text-xs text-muted-foreground mb-4">Automated tasks and alerts</p>
        <ToggleRow id="autoBackup" label="Automatic backups" desc="Daily backups at 2:00 AM UTC" />
        <ToggleRow id="emailNotifs" label="Email notifications" desc="Send digest emails to admins" />
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold mb-1 text-red-500">Danger Zone</h3>
        <p className="text-xs text-muted-foreground mb-4">Irreversible and destructive actions</p>
        <ToggleRow id="maintenanceMode" label="Maintenance mode" desc="Lock all user access except admins" />
        <div className="flex gap-2 mt-4 pt-4 border-t border-border">
          <button onClick={clearOrganizationData} className="text-sm px-4 py-2 rounded-lg border border-red-500/50 text-red-500 hover:bg-red-500/10 transition-colors">
            Clear all data
          </button>
          <button onClick={saveGeneral} className="text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors ml-auto">
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AI Chat Panel ────────────────────────────────────────────────────────────
function ChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "1", from: "ai", text: "Hi! I'm your NexusStorage AI assistant. I can help you find files, analyze storage usage, and answer questions about your data.", time: "now" },
  ]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatApi.conversations()
      .then(async conversations => conversations[0] || chatApi.create())
      .then(conversation => {
        setConversationId(conversation.id);
        if (conversation.messages.length) {
          setMessages(conversation.messages.map(message => ({
            id: message.id,
            from: message.role === "user" ? "user" : "ai",
            text: message.text,
            time: new Date(message.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          })));
        }
      })
      .catch(error => toast.error(error instanceof Error ? error.message : "Unable to load chat"));
  }, []);

  const send = async () => {
    if (!input.trim() || !conversationId || sending) return;
    const prompt = input.trim();
    const userMsg: ChatMessage = { id: Date.now().toString(), from: "user", text: input, time: "now" };
    setMessages(p => [...p, userMsg]);
    setInput("");
    setSending(true);
    try {
      const result = await chatApi.send(conversationId, prompt);
      const aiMsg: ChatMessage = {
        id: result.assistant_message.id,
        from: "ai",
        text: result.assistant_message.text,
        time: "now",
      };
      setMessages(p => [...p, aiMsg]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Assistant unavailable");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  return (
    <div className="w-80 h-full flex flex-col bg-card border-l border-border">
      <div className="h-14 px-4 flex items-center justify-between border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">AI Assistant</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={cn("flex gap-2", msg.from === "user" && "flex-row-reverse")}>
            {msg.from === "ai" && (
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <div className={cn(
              "max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed",
              msg.from === "ai" ? "bg-secondary" : "bg-primary text-primary-foreground"
            )}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Ask anything…"
            className="flex-1 text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50 transition-colors"
          />
          <button onClick={send} disabled={!input.trim() || !conversationId || sending} className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors">
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {["Find large files", "Storage report", "Shared links"].map(s => (
            <button key={s} onClick={() => setInput(s)} className="text-[10px] px-2 py-1 rounded-full bg-secondary hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground">
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
function AppContent({ portal }: { portal: Portal }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [bootAnimationDone, setBootAnimationDone] = useState(false);
  const [view, setView] = useState<View>(portal === "system" ? "workspaces" : "dashboard");
  const [theme, setTheme] = useState<Theme>("light");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    authApi.me()
      .then(apiUser => {
        const expected = portalForRole(apiUser.role);
        if (expected !== portal) {
          clearTokens(portal);
          window.location.replace(`${portalHome(expected)}${window.location.search || ""}`);
          return;
        }
        setUser(toUserProfile(apiUser));
        if (apiUser.role === "superadmin") setView("workspaces");
      })
      .catch(() => clearTokens(portal))
      .finally(() => setAuthLoading(false));
  }, [portal]);

  useEffect(() => {
    const timer = window.setTimeout(() => setBootAnimationDone(true), BOOT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const handleAuthenticated = (apiUser: ApiUser) => {
    const expected = portalForRole(apiUser.role);
    if (expected !== portal) return;
    setUser(toUserProfile(apiUser));
    setView(apiUser.role === "superadmin" ? "workspaces" : "dashboard");
  };

  if (authLoading || !bootAnimationDone) return <WorkspaceLoader />;

  if (!user) return <AuthScreen portal={portal} onAuthenticated={handleAuthenticated} />;

  return (
    <AuthenticatedShell
      user={user}
      setUser={setUser}
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

function AuthenticatedShell({
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
  const uploadAnywhere = useCallback(async (files: File[]) => {
    if (!files.length) return;
    try {
      await uploadFilesWithVirusScan(files);
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch {
      // toast already shown by uploadFilesWithVirusScan
    }
  }, [queryClient]);
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
      case "users": return <UserManagement />;
      case "settings": return <SystemSettings />;
      case "workspaces": return <WorkspacesView />;
      case "administrators": return <AdministratorsView />;
      case "profile": return <ProfileView user={user} onUserUpdate={(apiUser) => setUser(toUserProfile(apiUser))} />;
      default: return <DashboardView user={user} />;
    }
  };

  return (
    <div className="h-screen relative flex overflow-hidden bg-background font-sans animate-in fade-in duration-500" {...drop.handlers}>
      <DropOverlay active={drop.active} label="Drop anywhere to upload" />

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
              <ChatPanel onClose={() => setChatOpen(false)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PortalLanding() {
  const invite = new URLSearchParams(window.location.search).get("invite");
  if (invite) return <Navigate to={`/user/?invite=${encodeURIComponent(invite)}`} replace />;

  const portals: { id: Portal; title: string; blurb: string; icon: React.ElementType }[] = [
    { id: "user", title: "User portal", blurb: "Files, sharing, trash, and AI assistant", icon: User },
    { id: "admin", title: "Admin portal", blurb: "Workspace analytics, members, and settings", icon: Shield },
    { id: "system", title: "Super Admin", blurb: "Manage every workspace and administrator", icon: Crown },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl nexus-mark flex items-center justify-center mx-auto mb-3">
            <Cloud className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-brand text-3xl tracking-wide">NexusStorage</h1>
          <p className="text-sm text-muted-foreground mt-2">Choose a portal. Each keeps its own signed-in account.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {portals.map(({ id, title, blurb, icon: Icon }) => (
            <a
              key={id}
              href={portalHome(id)}
              className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: BRAND.brick + "18" }}>
                <Icon className="w-4 h-4" style={{ color: BRAND.brick }} />
              </div>
              <p className="font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{blurb}</p>
              <p className="text-xs text-primary mt-4 font-medium">Open /{id} →</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PortalLanding />} />
          <Route path="/user/*" element={<AppContent portal="user" />} />
          <Route path="/admin/*" element={<AppContent portal="admin" />} />
          <Route path="/system/*" element={<AppContent portal="system" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  );
}
