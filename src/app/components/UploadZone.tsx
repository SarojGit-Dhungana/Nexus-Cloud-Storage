import { useState, useCallback } from 'react';
import { Upload, X, Check, AlertCircle } from 'lucide-react';
import { cn } from './ui/utils';
import { Progress } from './ui/progress';
import type { UploadProgress } from '../types';

interface UploadZoneProps {
  onUpload?: (files: File[]) => void;
}

export function UploadZone({ onUpload }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      simulateUpload(files);
      onUpload?.(files);
    }
  }, [onUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      simulateUpload(files);
      onUpload?.(files);
    }
  }, [onUpload]);

  const simulateUpload = (files: File[]) => {
    const newUploads: UploadProgress[] = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      progress: 0,
      status: 'uploading' as const,
    }));

    setUploads(prev => [...prev, ...newUploads]);

    newUploads.forEach(upload => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setUploads(prev =>
            prev.map(u =>
              u.id === upload.id
                ? { ...u, progress: 100, status: Math.random() > 0.1 ? 'success' : 'error', error: Math.random() > 0.1 ? undefined : 'Upload failed' }
                : u
            )
          );
        } else {
          setUploads(prev =>
            prev.map(u => u.id === upload.id ? { ...u, progress } : u)
          );
        }
      }, 300);
    });
  };

  const removeUpload = (id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer",
          isDragging
            ? "border-primary bg-primary/10"
            : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
        )}
      >
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">
            {isDragging ? 'Drop files here' : 'Upload files'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Drag and drop files here, or click to browse
          </p>
        </label>
      </div>

      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{upload.file.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {(upload.file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {upload.status === 'uploading' && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {Math.round(upload.progress)}%
                    </div>
                  )}
                  {upload.status === 'success' && (
                    <Check className="w-5 h-5 text-green-500" />
                  )}
                  {upload.status === 'error' && (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                  <button
                    onClick={() => removeUpload(upload.id)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {upload.status === 'uploading' && (
                <Progress value={upload.progress} className="h-1" />
              )}

              {upload.status === 'error' && upload.error && (
                <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {upload.error}
                </div>
              )}

              {upload.status === 'success' && (
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Upload complete
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
