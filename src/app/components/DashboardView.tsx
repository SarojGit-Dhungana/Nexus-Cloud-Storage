import { Star, Clock, FileText } from 'lucide-react';
import { useState } from 'react';
import type { FileItem } from '../types';
import { mockFiles } from '../lib/mockData';
import { FileCard } from './FileCard';
import { ShareModal } from './ShareModal';
import { EmptyState } from './EmptyState';
import { toast } from 'sonner';

export function DashboardView() {
  const [files, setFiles] = useState<FileItem[]>(mockFiles);
  const [shareFile, setShareFile] = useState<FileItem | null>(null);

  const starredFiles = files.filter(f => f.starred).slice(0, 4);
  const recentFiles = [...files]
    .sort((a, b) => b.modified.getTime() - a.modified.getTime())
    .slice(0, 4);

  const handleShare = (file: FileItem) => {
    setShareFile(file);
  };

  const handleDelete = (file: FileItem) => {
    setFiles(prev => prev.filter(f => f.id !== file.id));
    toast.success(`"${file.name}" moved to trash`);
  };

  const handleRename = (file: FileItem) => {
    toast.info('Rename functionality would open a dialog here');
  };

  const handleDownload = (file: FileItem) => {
    toast.success(`Downloading "${file.name}"`);
  };

  const handleToggleStar = (file: FileItem) => {
    setFiles(prev =>
      prev.map(f =>
        f.id === file.id
          ? { ...f, starred: !f.starred }
          : f
      )
    );
    toast.success(file.starred ? 'Removed from starred' : 'Added to starred');
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Quick access to your files and recent activity
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg p-6">
          <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-2" />
          <div className="text-2xl font-semibold mb-1">{files.length}</div>
          <div className="text-sm text-blue-900 dark:text-blue-100">Total Files</div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-lg p-6">
          <Star className="w-8 h-8 text-purple-600 dark:text-purple-400 mb-2" />
          <div className="text-2xl font-semibold mb-1">
            {files.filter(f => f.starred).length}
          </div>
          <div className="text-sm text-purple-900 dark:text-purple-100">Starred</div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-lg p-6">
          <Clock className="w-8 h-8 text-green-600 dark:text-green-400 mb-2" />
          <div className="text-2xl font-semibold mb-1">
            {files.filter(f => f.shared).length}
          </div>
          <div className="text-sm text-green-900 dark:text-green-100">Shared</div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Starred files</h2>
        {starredFiles.length === 0 ? (
          <EmptyState
            icon={Star}
            title="No starred files"
            description="Star important files for quick access"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {starredFiles.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                onShare={handleShare}
                onDelete={handleDelete}
                onRename={handleRename}
                onDownload={handleDownload}
                onToggleStar={handleToggleStar}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Recent files</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recentFiles.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onShare={handleShare}
              onDelete={handleDelete}
              onRename={handleRename}
              onDownload={handleDownload}
              onToggleStar={handleToggleStar}
            />
          ))}
        </div>
      </div>

      <ShareModal
        file={shareFile}
        open={!!shareFile}
        onClose={() => setShareFile(null)}
      />
    </div>
  );
}
