import { useState } from 'react';
import { Link2, Copy, Check, Calendar, Lock } from 'lucide-react';
import type { FileItem } from '../types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';

interface ShareModalProps {
  file: FileItem | null;
  open: boolean;
  onClose: () => void;
}

export function ShareModal({ file, open, onClose }: ShareModalProps) {
  const [permission, setPermission] = useState<'view' | 'edit'>('view');
  const [expiration, setExpiration] = useState<string>('never');
  const [copied, setCopied] = useState(false);

  const shareUrl = file ? `https://nexusstorage.com/s/${file.id}` : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateLink = () => {
    toast.success('Share link generated');
  };

  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share "{file.name}"</DialogTitle>
          <DialogDescription>
            Anyone with the link can access this {file.type}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="permission">Permission</Label>
            <Select value={permission} onValueChange={(v) => setPermission(v as 'view' | 'edit')}>
              <SelectTrigger id="permission">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    <span>View only</span>
                  </div>
                </SelectItem>
                <SelectItem value="edit">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    <span>Can edit</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiration">Link expiration</Label>
            <Select value={expiration} onValueChange={setExpiration}>
              <SelectTrigger id="expiration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Never expires</span>
                  </div>
                </SelectItem>
                <SelectItem value="1day">1 day</SelectItem>
                <SelectItem value="7days">7 days</SelectItem>
                <SelectItem value="30days">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Share link</Label>
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm truncate">
                {shareUrl}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleGenerateLink} className="flex-1">
            <Link2 className="w-4 h-4 mr-2" />
            Generate Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
