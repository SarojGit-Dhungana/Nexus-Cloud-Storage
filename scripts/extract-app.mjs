/**
 * Extract monolithic App.tsx into modular components.
 * Line numbers are 1-indexed inclusive ranges from the original App.tsx.
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve("d:/Self-Project/Cloud Storage/src/app");
const APP = path.join(ROOT, "App.tsx");
const lines = fs.readFileSync(APP, "utf8").split(/\r?\n/);

/** Slice 1-indexed inclusive; returns lines without trailing empty from EOF */
function slice(start, end) {
  return lines.slice(start - 1, end).join("\n");
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function write(rel, content) {
  const full = path.join(ROOT, rel);
  ensureDir(full);
  fs.writeFileSync(full, content.replace(/\n+$/, "") + "\n", "utf8");
  console.log("wrote", rel, "(" + content.split("\n").length + " lines)");
}

function addExports(body, names) {
  let out = body;
  for (const name of names) {
    out = out.replace(new RegExp(`^function ${name}\\b`, "m"), `export function ${name}`);
    out = out.replace(new RegExp(`^const ${name}\\b`, "m"), `export const ${name}`);
    out = out.replace(new RegExp(`^type ${name}\\b`, "m"), `export type ${name}`);
    out = out.replace(new RegExp(`^interface ${name}\\b`, "m"), `export interface ${name}`);
  }
  return out;
}

function renameAvatarBadge(body) {
  return body
    .replace(/\bfunction Avatar\b/g, "function AppAvatar")
    .replace(/\bfunction Badge\b/g, "function AppBadge")
    .replace(/<Avatar\b/g, "<AppAvatar")
    .replace(/<\/Avatar>/g, "</AppAvatar>")
    .replace(/<Badge\b/g, "<AppBadge")
    .replace(/<\/Badge>/g, "</AppBadge>");
}

// ─── types ───────────────────────────────────────────────────────────────────
write(
  "types/app-types.ts",
  `export type Role = "superadmin" | "admin" | "user";
export type View =
  | "dashboard" | "files" | "shared" | "trash" | "admin" | "users" | "settings" | "profile"
  | "workspaces" | "administrators";
export type FileType = "folder" | "image" | "video" | "document" | "archive" | "code" | "pdf";
export type ViewMode = "grid" | "list";
export type Theme = "light" | "dark";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  storage: { used: number; total: number };
  twoFactorEnabled: boolean;
  twoFactorRequired: boolean;
}

export interface FileItem {
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

export interface ChatMessage {
  id: string;
  from: "user" | "ai";
  text: string;
  time: string;
}
`,
);

// ─── brand ───────────────────────────────────────────────────────────────────
write(
  "lib/brand.ts",
  `// Brand ramp shared with theme.css — dark green / pure red / black / white.
export const BRAND = {
  maroon: "#000000",
  rust: "#0A1F14",
  brick: "#145A32",
  clay: "#1B7A44",
  ember: "#FF0000",
  sand: "#3DA86A",
  bark: "#4A5C52",
};
export const BRAND_SERIES = [BRAND.brick, BRAND.ember, BRAND.clay, BRAND.maroon, BRAND.sand, BRAND.rust];
// Deeper tones only, so white initials stay legible.
export const AVATAR_COLORS = [BRAND.brick, BRAND.maroon, BRAND.clay, BRAND.rust, BRAND.bark, "#0F3322"];
export const ACTIVITY_COLORS: Record<string, string> = {
  share: BRAND.brick, upload: BRAND.clay, download: BRAND.sand,
  system: BRAND.bark, admin: BRAND.maroon, create: BRAND.sand, delete: BRAND.ember,
};
`,
);

// ─── format ──────────────────────────────────────────────────────────────────
write(
  "lib/format.ts",
  `export function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatBytes(gb: number) {
  return \`\${gb.toFixed(1)} GB\`;
}

export function formatByteCount(bytes: number) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return \`\${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} \${units[index]}\`;
}
`,
);

// ─── hooks: useExternalFileDrop ──────────────────────────────────────────────
write(
  "hooks/useExternalFileDrop.ts",
  `import { useState, useRef, useCallback } from "react";

export function hasExternalFiles(event: React.DragEvent) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

export function useExternalFileDrop(onFiles: (files: File[]) => void) {
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
`,
);

// ─── hooks: useUploadGuard ───────────────────────────────────────────────────
write(
  "hooks/useUploadGuard.tsx",
  `import { createContext, useContext } from "react";

export type UploadGuard = {
  upload: (files: File[], parent?: string) => Promise<void>;
  storageFull: boolean;
};

export const UploadGuardContext = createContext<UploadGuard | null>(null);

export function useUploadGuard() {
  const ctx = useContext(UploadGuardContext);
  if (!ctx) throw new Error("Upload guard unavailable");
  return ctx;
}
`,
);

// ─── lib/files.tsx ───────────────────────────────────────────────────────────
write(
  "lib/files.tsx",
  `import { toast } from "sonner";
import { Archive, FileCode, FileImage, FileText, FileVideo, Folder } from "lucide-react";
import { ApiError, ApiFile, ApiUser, fileApi } from "../api";
import { BRAND } from "./brand";
import { formatByteCount } from "./format";
import type { FileItem, FileType, UserProfile } from "../types/app-types";

export const NEXUS_FILE_MIME = "application/x-nexus-file-id";

/** Scan every file first; only upload after the antivirus API allows it. */
export async function uploadFilesWithVirusScan(files: File[], parent?: string) {
  const list = Array.from(files);
  if (!list.length) return [];
  const toastId = toast.loading(
    list.length === 1
      ? \`Scanning "\${list[0].name}" for viruses…\`
      : \`Scanning \${list.length} files for viruses…\`,
  );
  const saved = [];
  try {
    for (const file of list) {
      toast.loading(\`Scanning "\${file.name}"…\`, { id: toastId });
      const scan = await fileApi.scan(file);
      if (!scan.clean || !scan.allowed) {
        throw new Error(scan.detail || \`Virus detected (\${scan.threat}). Upload blocked.\`);
      }
      toast.loading(\`Clean — uploading "\${file.name}"…\`, { id: toastId });
      saved.push(await fileApi.store(file, parent));
    }
    toast.success(
      saved.length === 1
        ? \`Scanned clean and uploaded "\${saved[0].name}"\`
        : \`Scanned clean and uploaded \${saved.length} files\`,
      { id: toastId },
    );
    return saved;
  } catch (error) {
    if (error instanceof ApiError && error.status === 413) {
      toast.dismiss(toastId);
      throw error;
    }
    toast.error(error instanceof Error ? error.message : "Upload blocked by virus scan", { id: toastId });
    throw error;
  }
}

export function toUserProfile(user: ApiUser): UserProfile {
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

export function toUiFile(file: ApiFile): FileItem {
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

export function getFileIcon(type: FileType, color: string) {
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
`,
);

// Helper: take body, rename Avatar/Badge, add exports for given names
function transform(body, exportNames) {
  return addExports(renameAvatarBadge(body), exportNames);
}

const IMPORTS = {
  DropOverlay: `import { Upload } from "lucide-react";
`,
  WorkspaceLoader: `import { useEffect, useState } from "react";
import { Cloud, Loader2, Shield } from "lucide-react";
`,
  AuthScreen: `import { useState } from "react";
import { toast } from "sonner";
import { Cloud, Loader2, Mail, Shield } from "lucide-react";
import { ApiError, ApiUser, authApi, Portal, portalLabel, PortalMismatchError } from "../api";
import { cn } from "../lib/format";
`,
  AppAvatar: `import { BRAND } from "../lib/brand";
import { cn } from "../lib/format";
`,
  AppBadge: `import { cn } from "../lib/format";
`,
  StatCard: `import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "../lib/format";
`,
  Sidebar: `import { Cloud, HardDrive, LayoutDashboard, Files, Share2, Trash2, Settings, Users, BarChart3, Upload, Building2, Crown, Home, User } from "lucide-react";
import { portalHome } from "../api";
import { StorageMeter } from "../form-modals";
import { useUploadGuard } from "../hooks/useUploadGuard";
import { BRAND } from "../lib/brand";
import { cn, formatBytes } from "../lib/format";
import type { UserProfile, View } from "../types/app-types";
import { AppAvatar } from "./AppAvatar";
`,
  Header: `import { Bell, Menu, Moon, Search, Sun, Bot, LogOut, User, ChevronDown } from "lucide-react";
import { BRAND, AVATAR_COLORS } from "../lib/brand";
import { cn } from "../lib/format";
import type { Theme, UserProfile, View } from "../types/app-types";
import { AppAvatar } from "./AppAvatar";
`,
  DashboardView: `import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Activity, HardDrive, Share2, Upload, Files, Folder } from "lucide-react";
import { dashboardApi } from "../api";
import { ACTIVITY_COLORS, BRAND, BRAND_SERIES } from "../lib/brand";
import { formatBytes, formatByteCount } from "../lib/format";
import type { UserProfile } from "../types/app-types";
import { StatCard } from "./StatCard";
`,
  FilesView: `import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronRight, Download, Eye, Folder, Grid3X3, History, Link, List, Lock,
  MoreHorizontal, Move, Plus, Search, Share2, Star, Trash, Upload, X, Copy, Check,
} from "lucide-react";
import { authenticatedDownload, authenticatedPreview, fileApi } from "../api";
import { useConfirm, useFormPrompt } from "../form-modals";
import { useExternalFileDrop } from "../hooks/useExternalFileDrop";
import { useUploadGuard } from "../hooks/useUploadGuard";
import { NEXUS_FILE_MIME, getFileIcon, toUiFile } from "../lib/files";
import { cn } from "../lib/format";
import type { FileItem, ViewMode } from "../types/app-types";
import { DropOverlay } from "./DropOverlay";
import { ShareDialog } from "./ShareDialog";
`,
  ShareDialog: `import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, Link, Mail, Search, Share2, X } from "lucide-react";
import { fileApi } from "../api";
import { cn } from "../lib/format";
`,
  TwoFactorDialog: `import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Key, Loader2, QrCode, ShieldCheck, X } from "lucide-react";
import { authApi } from "../api";
`,
  ProfileView: `import { useRef, useState } from "react";
import { toast } from "sonner";
import { History, Key, LogOut, Shield, ShieldCheck, User } from "lucide-react";
import { ApiUser, authApi } from "../api";
import { AVATAR_COLORS, BRAND } from "../lib/brand";
import { formatBytes } from "../lib/format";
import type { UserProfile } from "../types/app-types";
import { AppAvatar } from "./AppAvatar";
import { AppBadge } from "./AppBadge";
import { TwoFactorDialog } from "./TwoFactorDialog";
`,
  SharedView: `import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Download, Eye, Share2, X } from "lucide-react";
import { authenticatedDownload, authenticatedPreview, fileApi } from "../api";
import { getFileIcon, toUiFile } from "../lib/files";
import { cn } from "../lib/format";
import { AppAvatar } from "./AppAvatar";
import { AppBadge } from "./AppBadge";
`,
  TrashView: `import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Trash, Trash2 } from "lucide-react";
import { fileApi } from "../api";
import { useConfirm } from "../form-modals";
import { getFileIcon, toUiFile } from "../lib/files";
`,
  WorkspacesView: `import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Plus, RefreshCw } from "lucide-react";
import { superAdminApi } from "../api";
import { useConfirm, useFormPrompt } from "../form-modals";
import { BRAND } from "../lib/brand";
import { formatByteCount } from "../lib/format";
import { AppBadge } from "./AppBadge";
`,
  AdministratorsView: `import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crown, Plus, RefreshCw, UserPlus } from "lucide-react";
import { superAdminApi } from "../api";
import { useConfirm, useFormPrompt } from "../form-modals";
import { AVATAR_COLORS } from "../lib/brand";
import { AppAvatar } from "./AppAvatar";
import { AppBadge } from "./AppBadge";
`,
  AdminAnalytics: `import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Activity, Database, HardDrive, Users } from "lucide-react";
import { adminApi } from "../api";
import { BRAND, BRAND_SERIES } from "../lib/brand";
import { formatByteCount, formatBytes } from "../lib/format";
import { StatCard } from "./StatCard";
`,
  UserManagement: `import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, RefreshCw, UserPlus, Users } from "lucide-react";
import { adminApi } from "../api";
import { useConfirm, useFormPrompt } from "../form-modals";
import { AVATAR_COLORS } from "../lib/brand";
import { formatByteCount } from "../lib/format";
import { AppAvatar } from "./AppAvatar";
import { AppBadge } from "./AppBadge";
`,
  SystemSettings: `import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Database, Globe, Shield, SlidersHorizontal } from "lucide-react";
import { adminApi, OrganizationSettings } from "../api";
import { cn } from "../lib/format";
`,
  ChatPanel: `import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bot, Check, Loader2, Plus, RefreshCw, Send, UserPlus, Users, X } from "lucide-react";
import { chatApi, Conversation, messagingApi } from "../api";
import { useConfirm, useFormPrompt } from "../form-modals";
import { AVATAR_COLORS, BRAND } from "../lib/brand";
import { cn } from "../lib/format";
import type { ChatMessage, UserProfile } from "../types/app-types";
import { AppAvatar } from "./AppAvatar";
`,
  AppContent: `import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Shield } from "lucide-react";
import { ApiError, ApiUser, authApi, clearTokens, Portal, portalForRole } from "../api";
import { isStorageFull, StorageFullNotice, wouldExceedStorage } from "../form-modals";
import { useExternalFileDrop } from "../hooks/useExternalFileDrop";
import { UploadGuardContext } from "../hooks/useUploadGuard";
import { toUserProfile, uploadFilesWithVirusScan } from "../lib/files";
import { cn, formatBytes } from "../lib/format";
import type { Theme, UserProfile, View } from "../types/app-types";
import { AdminAnalytics } from "./AdminAnalytics";
import { AdministratorsView } from "./AdministratorsView";
import { AuthScreen } from "./AuthScreen";
import { ChatPanel } from "./ChatPanel";
import { DashboardView } from "./DashboardView";
import { DropOverlay } from "./DropOverlay";
import { FilesView } from "./FilesView";
import { Header } from "./Header";
import { ProfileView } from "./ProfileView";
import { SharedView } from "./SharedView";
import { Sidebar } from "./Sidebar";
import { SystemSettings } from "./SystemSettings";
import { TrashView } from "./TrashView";
import { UserManagement } from "./UserManagement";
import { WorkspacesView } from "./WorkspacesView";
import { WorkspaceLoader, BOOT_DURATION_MS } from "./WorkspaceLoader";
`,
  PortalLanding: `import { Navigate } from "react-router";
import { Cloud, Crown, Shield, User } from "lucide-react";
import { Portal, portalHome } from "../api";
`,
};

// DropOverlay: lines 133-146
{
  let body = transform(slice(133, 146), ["DropOverlay"]);
  write("components/DropOverlay.tsx", IMPORTS.DropOverlay + "\n" + body);
}

// WorkspaceLoader: 258-329 (include BOOT constants; skip section comment lines optionally)
{
  let body = slice(260, 329);
  body = body.replace(/^const BOOT_STEPS/, "export const BOOT_STEPS");
  body = body.replace(/^const BOOT_DURATION_MS/, "export const BOOT_DURATION_MS");
  body = transform(body, ["WorkspaceLoader"]);
  write("components/WorkspaceLoader.tsx", IMPORTS.WorkspaceLoader + "\n" + body);
}

// AuthScreen: 331-516
{
  let body = transform(slice(332, 516), ["AuthScreen"]);
  write("components/AuthScreen.tsx", IMPORTS.AuthScreen + "\n" + body);
}

// AppAvatar: 518-526
{
  let body = transform(slice(519, 526), ["AppAvatar"]);
  write("components/AppAvatar.tsx", IMPORTS.AppAvatar + "\n" + body);
}

// AppBadge: 528-538
{
  let body = transform(slice(529, 538), ["AppBadge"]);
  write("components/AppBadge.tsx", IMPORTS.AppBadge + "\n" + body);
}

// StatCard: 864-885
{
  let body = transform(slice(865, 885), ["StatCard"]);
  write("components/StatCard.tsx", IMPORTS.StatCard + "\n" + body);
}

// Sidebar: 540-700
{
  let body = transform(slice(541, 700), ["Sidebar"]);
  // NAV constants should be fine as non-exported
  write("components/Sidebar.tsx", IMPORTS.Sidebar + "\n" + body);
}

// Header: 702-862
{
  let body = transform(slice(703, 862), ["Header"]);
  write("components/Header.tsx", IMPORTS.Header + "\n" + body);
}

// DashboardView: 887-1072
{
  let body = transform(slice(888, 1072), ["DashboardView"]);
  write("components/DashboardView.tsx", IMPORTS.DashboardView + "\n" + body);
}

// FilesView: 1074-1619
{
  let body = transform(slice(1075, 1619), ["EncryptedAuditRow", "FilesView"]);
  write("components/FilesView.tsx", IMPORTS.FilesView + "\n" + body);
}

// ShareDialog: 1621-1751
{
  let body = transform(slice(1625, 1751), ["ShareDialog"]);
  write("components/ShareDialog.tsx", IMPORTS.ShareDialog + "\n" + body);
}

// TwoFactorDialog: 1753-1855
{
  let body = transform(slice(1754, 1855), ["TwoFactorDialog"]);
  write("components/TwoFactorDialog.tsx", IMPORTS.TwoFactorDialog + "\n" + body);
}

// ProfileView: 1857-1997
{
  let body = transform(slice(1858, 1997), ["ProfileView"]);
  write("components/ProfileView.tsx", IMPORTS.ProfileView + "\n" + body);
}

// SharedView: 1999-2164
{
  let body = transform(slice(1999, 2164), ["SharedView"]);
  write("components/SharedView.tsx", IMPORTS.SharedView + "\n" + body);
}

// TrashView: 2166-2281
{
  let body = transform(slice(2167, 2281), ["TrashView"]);
  write("components/TrashView.tsx", IMPORTS.TrashView + "\n" + body);
}

// WorkspacesView: 2283-2423
{
  let body = transform(slice(2284, 2423), ["WorkspacesView"]);
  write("components/WorkspacesView.tsx", IMPORTS.WorkspacesView + "\n" + body);
}

// AdministratorsView: 2425-2601
{
  let body = transform(slice(2426, 2601), ["AdministratorsView"]);
  write("components/AdministratorsView.tsx", IMPORTS.AdministratorsView + "\n" + body);
}

// AdminAnalytics: 2603-2711
{
  let body = transform(slice(2604, 2711), ["AdminAnalytics"]);
  write("components/AdminAnalytics.tsx", IMPORTS.AdminAnalytics + "\n" + body);
}

// UserManagement: 2713-2836
{
  let body = transform(slice(2714, 2836), ["UserManagement"]);
  write("components/UserManagement.tsx", IMPORTS.UserManagement + "\n" + body);
}

// SystemSettings: 2838-3006
{
  let body = transform(slice(2839, 3006), ["SystemSettings"]);
  write("components/SystemSettings.tsx", IMPORTS.SystemSettings + "\n" + body);
}

// ChatPanel stack: 3008-3558
{
  let body = transform(slice(3009, 3558), [
    "ChatPanel",
    "FriendsChatPane",
    "AiChatPane",
    "isDefaultAiTitle",
    "mapAiMessages",
  ]);
  // Also export AI constants if referenced externally — keep as const
  body = body.replace(/^const AI_DEFAULT_TITLE/, "const AI_DEFAULT_TITLE");
  body = body.replace(/^const AI_WELCOME/, "const AI_WELCOME");
  write("components/ChatPanel.tsx", IMPORTS.ChatPanel + "\n" + body);
}

// AppContent + AuthenticatedShell: 3560-3789
{
  let body = transform(slice(3561, 3789), ["AppContent", "AuthenticatedShell"]);
  write("components/AppContent.tsx", IMPORTS.AppContent + "\n" + body);
}

// PortalLanding: 3791-3872
{
  let body = transform(slice(3791, 3872), ["PortalLanding"]);
  write("components/PortalLanding.tsx", IMPORTS.PortalLanding + "\n" + body);
}

// Thin App.tsx
write(
  "App.tsx",
  `import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AppContent } from "./components/AppContent";
import { PortalLanding } from "./components/PortalLanding";

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

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
`,
);

console.log("\nDone.");
