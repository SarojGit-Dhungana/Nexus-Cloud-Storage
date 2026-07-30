import { Archive, FileCode, FileImage, FileText, FileVideo, Folder } from "lucide-react";
import { ApiError, ApiFile, ApiUser, fileApi } from "../api";
import { BRAND } from "./brand";
import { formatByteCount } from "./format";
import type { FileItem, FileType, UserProfile } from "../types/app-types";

export const NEXUS_FILE_MIME = "application/x-nexus-file-id";

export type UploadScanProgress = {
  status: "scanning" | "uploading" | "success" | "error";
  fileName: string;
  index: number;
  total: number;
  message: string;
};

/** Scan every file first; only upload after the antivirus API allows it. */
export async function uploadFilesWithVirusScan(
  files: File[],
  parent?: string,
  onProgress?: (progress: UploadScanProgress) => void,
) {
  const list = Array.from(files);
  if (!list.length) return [];
  const total = list.length;
  const saved: ApiFile[] = [];

  const report = (partial: Omit<UploadScanProgress, "total">) => {
    onProgress?.({ ...partial, total });
  };

  try {
    for (let index = 0; index < list.length; index += 1) {
      const file = list[index];
      report({
        status: "scanning",
        fileName: file.name,
        index,
        message: `Scanning "${file.name}" for viruses and duplicate content…`,
      });
      const scan = await fileApi.scan(file);
      if (!scan.clean || !scan.allowed) {
        throw new Error(scan.detail || `Virus detected (${scan.threat}). Upload blocked.`);
      }
      report({
        status: "uploading",
        fileName: file.name,
        index,
        message: `Clean — uploading "${file.name}"…`,
      });
      saved.push(await fileApi.store(file, parent));
    }
    report({
      status: "success",
      fileName: saved.length === 1 ? saved[0].name : `${saved.length} files`,
      index: Math.max(total - 1, 0),
      message:
        saved.length === 1
          ? `Scanned clean and uploaded "${saved[0].name}".`
          : `Scanned clean and uploaded ${saved.length} files.`,
    });
    return saved;
  } catch (error) {
    if (error instanceof ApiError && error.status === 413) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Upload blocked by virus scan";
    const current = list[Math.min(saved.length, list.length - 1)];
    report({
      status: "error",
      fileName: current?.name || "",
      index: Math.min(saved.length, Math.max(total - 1, 0)),
      message,
    });
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
