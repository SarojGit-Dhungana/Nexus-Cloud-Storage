import { useState } from 'react';
import { Trash2, Grid3x3, List, RotateCcw } from 'lucide-react';
import type { FileItem, ViewMode } from '../types';
import { FileCard } from './FileCard';
import { FileTable } from './FileTable';
import { EmptyState } from './EmptyState';
import { Button } from './ui/button';
import { toast } from 'sonner';

export function TrashView() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [files, setFiles] = useState<FileItem[]>([]);

  const handleRestore = (file: FileItem) => {
    setFiles(prev => prev.filter(f => f.id !== file.id));
    toast.success(`"${file.name}" restored`);
  };

  const handlePermanentDelete = (file: FileItem) => {
    setFiles(prev => prev.filter(f => f.id !== file.id));
    toast.success(`"${file.name}" permanently deleted`);
  };

  const handleEmptyTrash = () => {
    setFiles([]);
    toast.success('Trash emptied');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Trash</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Items in trash are deleted after 30 days
          </p>
        </div>

        <div className="flex items-center gap-2">
          {files.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEmptyTrash}
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Empty Trash
              </Button>
            </>
          )}

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
          icon={Trash2}
          title="Trash is empty"
          description="Deleted files will appear here and be permanently removed after 30 days"
        />
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {files.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  onDelete={handlePermanentDelete}
                  onDownload={handleRestore}
                />
              ))}
            </div>
          ) : (
            <FileTable
              files={files}
              onDelete={handlePermanentDelete}
              onDownload={handleRestore}
            />
          )}
        </>
      )}
    </div>
  );
}
