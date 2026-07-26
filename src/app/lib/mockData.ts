import type { FileItem, User, ActivityLog, StorageStats } from '../types';

export const currentUser: User = {
  id: '1',
  name: 'Sarah Chen',
  email: 'sarah.chen@company.com',
  avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
  role: 'admin',
};

export const mockFiles: FileItem[] = [
  {
    id: '1',
    name: 'Q1 Financial Report.pdf',
    type: 'file',
    size: 2457600,
    mimeType: 'application/pdf',
    modified: new Date('2026-04-28'),
    owner: 'Sarah Chen',
    shared: true,
    starred: true,
    path: ['My Files'],
  },
  {
    id: '2',
    name: 'Product Roadmap 2026',
    type: 'folder',
    size: 0,
    modified: new Date('2026-04-25'),
    owner: 'Sarah Chen',
    shared: false,
    starred: false,
    path: ['My Files'],
  },
  {
    id: '3',
    name: 'Team Photo.jpg',
    type: 'file',
    size: 4567890,
    mimeType: 'image/jpeg',
    modified: new Date('2026-04-20'),
    owner: 'John Doe',
    shared: true,
    starred: false,
    path: ['My Files'],
  },
  {
    id: '4',
    name: 'Architecture Diagram.png',
    type: 'file',
    size: 1234567,
    mimeType: 'image/png',
    modified: new Date('2026-04-18'),
    owner: 'Sarah Chen',
    shared: false,
    starred: true,
    path: ['My Files'],
  },
  {
    id: '5',
    name: 'Meeting Notes.docx',
    type: 'file',
    size: 345678,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    modified: new Date('2026-04-15'),
    owner: 'Sarah Chen',
    shared: false,
    starred: false,
    path: ['My Files'],
  },
  {
    id: '6',
    name: 'Design Assets',
    type: 'folder',
    size: 0,
    modified: new Date('2026-04-10'),
    owner: 'Sarah Chen',
    shared: true,
    starred: false,
    path: ['My Files'],
  },
  {
    id: '7',
    name: 'Budget Spreadsheet.xlsx',
    type: 'file',
    size: 678901,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    modified: new Date('2026-04-08'),
    owner: 'Sarah Chen',
    shared: false,
    starred: false,
    path: ['My Files'],
  },
  {
    id: '8',
    name: 'Client Presentation.pptx',
    type: 'file',
    size: 8901234,
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    modified: new Date('2026-04-05'),
    owner: 'Jane Smith',
    shared: true,
    starred: true,
    path: ['My Files'],
  },
];

export const mockActivityLogs: ActivityLog[] = [
  {
    id: '1',
    user: 'Sarah Chen',
    action: 'Uploaded',
    fileName: 'Q1 Financial Report.pdf',
    timestamp: new Date('2026-04-30T09:15:00'),
  },
  {
    id: '2',
    user: 'John Doe',
    action: 'Shared',
    fileName: 'Team Photo.jpg',
    timestamp: new Date('2026-04-30T08:45:00'),
  },
  {
    id: '3',
    user: 'Jane Smith',
    action: 'Downloaded',
    fileName: 'Client Presentation.pptx',
    timestamp: new Date('2026-04-30T08:30:00'),
  },
  {
    id: '4',
    user: 'Sarah Chen',
    action: 'Modified',
    fileName: 'Architecture Diagram.png',
    timestamp: new Date('2026-04-29T16:20:00'),
  },
  {
    id: '5',
    user: 'Mike Johnson',
    action: 'Uploaded',
    fileName: 'Marketing Plan.pdf',
    timestamp: new Date('2026-04-29T14:10:00'),
  },
];

export const mockStorageStats: StorageStats = {
  used: 47318695936, // ~44 GB
  total: 107374182400, // 100 GB
  activeUsers: 12,
  totalFiles: 247,
};

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatDate(date: Date): string {
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 24) {
    return 'Today';
  } else if (diffInHours < 48) {
    return 'Yesterday';
  } else if (diffInHours < 168) {
    return `${Math.floor(diffInHours / 24)} days ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

export function getFileIcon(item: FileItem): string {
  if (item.type === 'folder') return 'folder';

  const ext = item.name.split('.').pop()?.toLowerCase();
  const mimeType = item.mimeType?.toLowerCase() || '';

  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.includes('pdf')) return 'file-text';
  if (mimeType.includes('word') || ext === 'doc' || ext === 'docx') return 'file-text';
  if (mimeType.includes('sheet') || ext === 'xls' || ext === 'xlsx') return 'table';
  if (mimeType.includes('presentation') || ext === 'ppt' || ext === 'pptx') return 'presentation';
  if (ext === 'zip' || ext === 'rar' || ext === '7z') return 'archive';

  return 'file';
}
