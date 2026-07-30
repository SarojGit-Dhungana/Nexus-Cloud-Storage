export type Role = "superadmin" | "admin" | "user";
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
