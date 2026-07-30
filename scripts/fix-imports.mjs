/**
 * Fix missing imports in extracted App components.
 * Replaces everything before the first `export ` / `type ` / `const NAV` / `function` body marker.
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve("d:/Self-Project/Cloud Storage/src/app/components");

function setImports(file, imports) {
  const full = path.join(ROOT, file);
  let body = fs.readFileSync(full, "utf8");
  // Strip existing import block (from start through blank line before first export/type/const/function that is the component)
  const match = body.match(/\n(?=(?:export |type |const NAV_|const AI_|function ))/);
  if (!match || match.index == null) {
    console.error("no body start in", file);
    return;
  }
  // Find first non-import content: look for line that starts with export/type/const/function and isn't part of import
  const lines = body.split(/\r?\n/);
  let cut = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      line.startsWith("import ") ||
      line.startsWith("}") ||
      line.startsWith("  ") ||
      line.startsWith("\t") ||
      line.trim() === "" ||
      line.startsWith("} from") ||
      line.includes("} from ")
    ) {
      // still in imports — but blank lines after imports should stop
      if (line.trim() === "" && i > 0 && !lines[i - 1].startsWith("import ") && !lines[i - 1].includes("} from") && !lines[i - 1].startsWith("  ")) {
        cut = i + 1;
        break;
      }
      continue;
    }
    cut = i;
    break;
  }
  // Simpler: find first line matching export | type Folder | const NAV | const AI
  cut = lines.findIndex((l) => /^(export |type Folder|const NAV_|const AI_|\/\/ ─)/.test(l));
  if (cut < 0) {
    console.error("cannot find cut for", file);
    return;
  }
  const rest = lines.slice(cut).join("\n");
  fs.writeFileSync(full, imports.trim() + "\n\n" + rest.replace(/\n+$/, "") + "\n", "utf8");
  console.log("fixed", file);
}

setImports("WorkspaceLoader.tsx", `
import { useEffect, useState } from "react";
import { Check, Cloud, Loader2, Lock, RefreshCw, Shield } from "lucide-react";
import { cn } from "../lib/format";
`);

setImports("AuthScreen.tsx", `
import { useState } from "react";
import { toast } from "sonner";
import { Cloud, Loader2, Mail, Shield } from "lucide-react";
import { ApiError, ApiUser, authApi, Portal, portalForRole, portalLabel, PortalMismatchError } from "../api";
import { cn } from "../lib/format";
`);

setImports("Header.tsx", `
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Bot, ChevronDown, Key, Lock, LogOut, Menu, Moon, Search, Sun, User, X } from "lucide-react";
import { authenticatedPreview, dashboardApi, fileApi } from "../api";
import { AVATAR_COLORS, BRAND } from "../lib/brand";
import { getFileIcon } from "../lib/files";
import { cn } from "../lib/format";
import type { Theme, UserProfile, View } from "../types/app-types";
import { AppAvatar } from "./AppAvatar";
import { AppBadge } from "./AppBadge";
`);

setImports("Sidebar.tsx", `
import { BarChart3, Building2, Cloud, Crown, Files, HardDrive, LayoutDashboard, Settings, Share2, Trash2, Upload, Users } from "lucide-react";
import { portalHome } from "../api";
import { StorageMeter } from "../form-modals";
import { useUploadGuard } from "../hooks/useUploadGuard";
import { BRAND } from "../lib/brand";
import { cn, formatBytes } from "../lib/format";
import type { UserProfile, View } from "../types/app-types";
import { AppAvatar } from "./AppAvatar";
`);

setImports("DashboardView.tsx", `
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
import { DropOverlay } from "./DropOverlay";
import { StatCard } from "./StatCard";
`);

setImports("FilesView.tsx", `
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity, ArrowUpRight, Check, ChevronRight, Copy, Download, Eye, FileText, Folder, FolderOpen,
  Grid3X3, History, Home, Link, List, Lock, MoreHorizontal, Move, Plus, Search, Share2, Star,
  Trash, Upload, X,
} from "lucide-react";
import { authenticatedDownload, authenticatedPreview, fileApi } from "../api";
import { useConfirm, useFormPrompt } from "../form-modals";
import { hasExternalFiles, useExternalFileDrop } from "../hooks/useExternalFileDrop";
import { useUploadGuard } from "../hooks/useUploadGuard";
import { ACTIVITY_COLORS, BRAND } from "../lib/brand";
import { NEXUS_FILE_MIME, getFileIcon, toUiFile } from "../lib/files";
import { cn } from "../lib/format";
import type { FileItem, ViewMode } from "../types/app-types";
import { DropOverlay } from "./DropOverlay";
import { ShareDialog } from "./ShareDialog";
`);

setImports("ShareDialog.tsx", `
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, Globe, Link, Loader2, Mail, Search, Share2, X } from "lucide-react";
import { fileApi } from "../api";
import { cn } from "../lib/format";
`);

setImports("TwoFactorDialog.tsx", `
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Key, Loader2, QrCode, ShieldCheck, X } from "lucide-react";
import { authApi } from "../api";
`);

setImports("ProfileView.tsx", `
import { useRef, useState } from "react";
import { toast } from "sonner";
import { HardDrive, History, Key, Loader2, LogOut, QrCode, Shield, ShieldAlert, ShieldCheck, User } from "lucide-react";
import { ApiUser, authApi, clearTokens } from "../api";
import { StorageMeter, useFormPrompt } from "../form-modals";
import { AVATAR_COLORS, BRAND } from "../lib/brand";
import { formatBytes } from "../lib/format";
import type { UserProfile } from "../types/app-types";
import { AppAvatar } from "./AppAvatar";
import { AppBadge } from "./AppBadge";
import { TwoFactorDialog } from "./TwoFactorDialog";
`);

setImports("SharedView.tsx", `
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Download, Eye, Share2, X } from "lucide-react";
import { authenticatedDownload, authenticatedPreview, fileApi } from "../api";
import { BRAND } from "../lib/brand";
import { getFileIcon, toUiFile } from "../lib/files";
import { cn } from "../lib/format";
import type { FileItem, FileType } from "../types/app-types";
import { AppAvatar } from "./AppAvatar";
import { AppBadge } from "./AppBadge";
import { ShareDialog } from "./ShareDialog";
`);

setImports("TrashView.tsx", `
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Trash, Trash2 } from "lucide-react";
import { fileApi } from "../api";
import { useConfirm } from "../form-modals";
import { getFileIcon, toUiFile } from "../lib/files";
import { cn } from "../lib/format";
import type { FileItem } from "../types/app-types";
`);

setImports("WorkspacesView.tsx", `
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Crown, Database, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { superAdminApi, Workspace } from "../api";
import { useConfirm, useFormPrompt } from "../form-modals";
import { BRAND } from "../lib/brand";
import { cn, formatByteCount } from "../lib/format";
import { AppBadge } from "./AppBadge";
import { StatCard } from "./StatCard";
`);

setImports("AdministratorsView.tsx", `
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crown, Plus, RefreshCw, UserPlus } from "lucide-react";
import { superAdminApi, SystemUser } from "../api";
import { useConfirm, useFormPrompt } from "../form-modals";
import { AVATAR_COLORS } from "../lib/brand";
import { cn } from "../lib/format";
import { AppAvatar } from "./AppAvatar";
import { AppBadge } from "./AppBadge";
`);

setImports("AdminAnalytics.tsx", `
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Activity, Cpu, Database, HardDrive, Users } from "lucide-react";
import { adminApi, dashboardApi } from "../api";
import { StorageMeter } from "../form-modals";
import { ACTIVITY_COLORS, BRAND, BRAND_SERIES } from "../lib/brand";
import { cn, formatByteCount, formatBytes } from "../lib/format";
import { StatCard } from "./StatCard";
`);

setImports("UserManagement.tsx", `
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal, Plus, RefreshCw, Search, UserPlus, Users } from "lucide-react";
import { adminApi, ApiUser } from "../api";
import { useConfirm, useFormPrompt } from "../form-modals";
import { AVATAR_COLORS } from "../lib/brand";
import { formatByteCount } from "../lib/format";
import { AppAvatar } from "./AppAvatar";
import { AppBadge } from "./AppBadge";
`);

setImports("SystemSettings.tsx", `
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Database, Globe, Shield, SlidersHorizontal } from "lucide-react";
import { adminApi, dashboardApi, OrganizationSettings } from "../api";
import { StorageMeter, useFormPrompt } from "../form-modals";
import { cn } from "../lib/format";
`);

setImports("ChatPanel.tsx", `
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bot, Check, ChevronRight, History, Loader2, Mail, MoreHorizontal, Plus, RefreshCw,
  Send, Sparkles, Trash, UserPlus, Users, X,
} from "lucide-react";
import { chatApi, ChatContact, Conversation, DirectChatMessage, messagingApi } from "../api";
import { useConfirm, useFormPrompt } from "../form-modals";
import { AVATAR_COLORS, BRAND } from "../lib/brand";
import { cn } from "../lib/format";
import type { ChatMessage, UserProfile } from "../types/app-types";
import { AppAvatar } from "./AppAvatar";
`);

setImports("AppContent.tsx", `
import { useCallback, useEffect, useState } from "react";
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
import { BOOT_DURATION_MS, WorkspaceLoader } from "./WorkspaceLoader";
`);

setImports("PortalLanding.tsx", `
import { Navigate } from "react-router";
import { Cloud, Crown, Shield, User } from "lucide-react";
import { Portal, portalHome } from "../api";
`);

console.log("done");
