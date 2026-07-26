import { useState } from 'react';
import { Grid3x3, List, Upload as UploadIcon, FolderPlus, ChevronRight } from 'lucide-react';
import type { FileItem, ViewMode } from '../types';
import { mockFiles } from '../lib/mockData';
import { FileCard } from './FileCard';
import { FileTable } from './FileTable';
import { UploadZone } from './UploadZone';
import { ShareModal } from './ShareModal';
import { EmptyState } from './EmptyState';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

export function FilesView() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [files, setFiles] = useState<FileItem[]>(mockFiles);
  const [currentPath, setCurrentPath] = useState<string[]>(['My Files']);
  const [shareFile, setShareFile] = useState<FileItem | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

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

  const handleUpload = (uploadedFiles: File[]) => {
    toast.success(`${uploadedFiles.length} file(s) uploaded`);
  };

  const displayedFiles = files.filter(file =>
    file.path.join('/') === currentPath.join('/')
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {currentPath.map((segment, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
              <button
                onClick={() => setCurrentPath(currentPath.slice(0, index + 1))}
                className={
                  index === currentPath.length - 1
                    ? 'font-semibold'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }
              >
                {segment}
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUploadDialog(true)}
          >
            <UploadIcon className="w-4 h-4 mr-2" />
            Upload
          </Button>
          <Button variant="outline" size="sm">
            <FolderPlus className="w-4 h-4 mr-2" />
            New Folder
          </Button>

          <Separator orientation="vertical" className="h-6" />

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

      {displayedFiles.length === 0 ? (
        <EmptyState
          icon={UploadIcon}
          title="No files yet"
          description="Upload your first file to get started"
          action={{
            label: 'Upload Files',
            onClick: () => setShowUploadDialog(true)
          }}
        />
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayedFiles.map((file) => (
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
              files={displayedFiles}
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

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>
              Drag and drop your files or click to browse
            </DialogDescription>
          </DialogHeader>
          <UploadZone onUpload={handleUpload} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
