import {
  File,
  Folder,
  FileText,
  Image as ImageIcon,
  Video,
  Table as TableIcon,
  Presentation,
  Archive,
  Star,
  Share2,
  MoreVertical,
  Download,
  Pencil,
  Trash2
} from 'lucide-react';
import type { FileItem } from '../types';
import { getFileIcon, formatFileSize, formatDate } from '../lib/mockData';
import { cn } from './ui/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
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

interface FileTableProps {
  files: FileItem[];
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
  table: TableIcon,
  presentation: Presentation,
  archive: Archive,
};

export function FileTable({ files, onShare, onDelete, onRename, onDownload, onToggleStar }: FileTableProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Modified</TableHead>
            <TableHead>Size</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => {
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
              <ContextMenu key={file.id}>
                <ContextMenuTrigger asChild>
                  <TableRow className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <TableCell>
                      <button onClick={() => onToggleStar?.(file)}>
                        <Star className={cn(
                          "w-4 h-4 transition-colors",
                          file.starred
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300 dark:text-gray-700 hover:text-gray-400 dark:hover:text-gray-600"
                        )} />
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded flex items-center justify-center",
                          file.type === 'folder'
                            ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                            : "bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400"
                        )}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{file.name}</span>
                          {file.shared && (
                            <Share2 className="w-3 h-3 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600 dark:text-gray-400">
                      {file.owner}
                    </TableCell>
                    <TableCell className="text-gray-600 dark:text-gray-400">
                      {formatDate(file.modified)}
                    </TableCell>
                    <TableCell className="text-gray-600 dark:text-gray-400">
                      {formatFileSize(file.size)}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                  </TableRow>
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
          })}
        </TableBody>
      </Table>
    </div>
  );
}
