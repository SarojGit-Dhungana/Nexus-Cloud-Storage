import { useState } from 'react';
import { Share2, Grid3x3, List } from 'lucide-react';
import type { FileItem, ViewMode } from '../types';
import { mockFiles } from '../lib/mockData';
import { FileCard } from './FileCard';
import { FileTable } from './FileTable';
import { ShareModal } from './ShareModal';
import { EmptyState } from './EmptyState';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { toast } from 'sonner';

export function SharedView() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [files, setFiles] = useState<FileItem[]>(mockFiles.filter(f => f.shared));
  const [shareFile, setShareFile] = useState<FileItem | null>(null);

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Shared with me</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Files and folders others have shared with you
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${
                viewMode === 'grid'
                  ? 'bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900/50'
              }`}
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 ${
                viewMode === 'table'
                  ? 'bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900/50'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {files.length === 0 ? (
        <EmptyState
          icon={Share2}
          title="No shared files"
          description="Files that others share with you will appear here"
        />
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {files.map((file) => (
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
          ) : (
            <FileTable
              files={files}
              onShare={handleShare}
              onDelete={handleDelete}
              onRename={handleRename}
              onDownload={handleDownload}
              onToggleStar={handleToggleStar}
            />
          )}
        </>
      )}

      <ShareModal
        file={shareFile}
        open={!!shareFile}
        onClose={() => setShareFile(null)}
      />
    </div>
  );
}
