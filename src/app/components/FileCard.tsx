import {
  File,
  Folder,
  FileText,
  Image as ImageIcon,
  Video,
  Table,
  Presentation,
  Archive,
  MoreVertical,
  Star,
  Share2,
  Download,
  Pencil,
  Trash2
} from 'lucide-react';
import type { FileItem } from '../types';
import { getFileIcon, formatFileSize, formatDate } from '../lib/mockData';
import { cn } from './ui/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';

interface FileCardProps {
  file: FileItem;
  onShare?: (file: FileItem) => void;
  onDelete?: (file: FileItem) => void;
  onRename?: (file: FileItem) => void;
  onDownload?: (file: FileItem) => void;
  onToggleStar?: (file: FileItem) => void;
}

const iconMap: Record<string, React.ElementType> = {
  folder: Folder,
  file: File,
  'file-text': FileText,
  image: ImageIcon,
  video: Video,
  table: Table,
  presentation: Presentation,
  archive: Archive,
};

export function FileCard({ file, onShare, onDelete, onRename, onDownload, onToggleStar }: FileCardProps) {
  const iconName = getFileIcon(file);
  const Icon = iconMap[iconName] || File;

  const menuItems = (
    <>
      <DropdownMenuItem onClick={() => onShare?.(file)}>
        <Share2 className="w-4 h-4 mr-2" />
        Share
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onDownload?.(file)}>
        <Download className="w-4 h-4 mr-2" />
        Download
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onRename?.(file)}>
        <Pencil className="w-4 h-4 mr-2" />
        Rename
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onToggleStar?.(file)}>
        <Star className={cn("w-4 h-4 mr-2", file.starred && "fill-yellow-400 text-yellow-400")} />
        {file.starred ? 'Unstar' : 'Star'}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => onDelete?.(file)} className="text-red-600 dark:text-red-400">
        <Trash2 className="w-4 h-4 mr-2" />
        Delete
      </DropdownMenuItem>
    </>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div className="group relative bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm transition-all cursor-pointer">
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {menuItems}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {file.starred && (
            <div className="absolute top-3 left-3">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            </div>
          )}

          <div className="flex flex-col items-center gap-3 mt-2">
            <div className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center",
              file.type === 'folder'
                ? "bg-primary/10 text-primary"
                : "bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400"
            )}>
              <Icon className="w-6 h-6" />
            </div>

            <div className="w-full text-center space-y-1">
              <div className="font-medium text-sm truncate" title={file.name}>
                {file.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 space-x-2">
                {file.type === 'file' && <span>{formatFileSize(file.size)}</span>}
                <span>•</span>
                <span>{formatDate(file.modified)}</span>
              </div>
            </div>
          </div>

          {file.shared && (
            <div className="absolute bottom-3 right-3">
              <Share2 className="w-3 h-3 text-gray-400" />
            </div>
          )}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={() => onShare?.(file)}>
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onDownload?.(file)}>
          <Download className="w-4 h-4 mr-2" />
          Download
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onRename?.(file)}>
          <Pencil className="w-4 h-4 mr-2" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onToggleStar?.(file)}>
          <Star className={cn("w-4 h-4 mr-2", file.starred && "fill-yellow-400 text-yellow-400")} />
          {file.starred ? 'Unstar' : 'Star'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onDelete?.(file)} className="text-red-600 dark:text-red-400">
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
