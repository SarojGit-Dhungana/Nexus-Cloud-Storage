export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size: number;
  mimeType?: string;
  modified: Date;
  owner: string;
  shared: boolean;
  starred: boolean;
  path: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'user';
}

export interface ShareLink {
  id: string;
  fileId: string;
  url: string;
  expiresAt: Date | null;
  permission: 'view' | 'edit';
  createdAt: Date;
}

export interface UploadProgress {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

export interface ActivityLog {
  id: string;
  user: string;
  action: string;
  fileName: string;
  timestamp: Date;
}

export interface StorageStats {
  used: number;
  total: number;
  activeUsers: number;
  totalFiles: number;
}

export type ViewMode = 'grid' | 'table';
export type SidebarView = 'dashboard' | 'files' | 'shared' | 'trash' | 'admin';
