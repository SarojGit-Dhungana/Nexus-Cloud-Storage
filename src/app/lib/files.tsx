import { toast } from "sonner";
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
