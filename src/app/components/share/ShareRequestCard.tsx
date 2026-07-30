/** One pending / sent share request row (component, not inline JSX). */
import { Check, Download, Eye, Share2, X } from "lucide-react";
import type { ShareRequest } from "../../api";
import { BRAND } from "../../lib/brand";
import { getFileIcon } from "../../lib/files";
import type { FileType } from "../../types/app-types";

type Props = {
  share: ShareRequest;
  mode: "pending" | "sent";
  busy?: boolean;
  onAccept?: () => void;
  onIgnore?: () => void;
  onRevoke?: () => void;
  onPreview?: () => void;
  onDownload?: () => void;
  onReshare?: () => void;
};

export function ShareRequestCard({
  share,
  mode,
  busy,
  onAccept,
  onIgnore,
  onRevoke,
  onPreview,
  onDownload,
  onReshare,
}: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 flex-wrap">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND.brick + "18" }}>
        {getFileIcon((share.file_type as FileType) || "document", BRAND.brick)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{share.file_name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {mode === "pending"
            ? `From ${share.sender_name} · ${share.permission} access · ${new Date(share.created_at).toLocaleString()}`
            : `To ${share.recipient_email} · ${share.status} · ${share.permission}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {mode === "pending" && (
          <>
            <button disabled={busy} onClick={onAccept} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center gap-1">
              <Check className="w-3 h-3" /> Accept
            </button>
            <button disabled={busy} onClick={onIgnore} className="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted disabled:opacity-60 flex items-center gap-1">
              <X className="w-3 h-3" /> Ignore
            </button>
          </>
        )}
        {mode === "sent" && (
          <>
            {onPreview && (
              <button onClick={onPreview} className="p-1.5 rounded-lg hover:bg-secondary" title="Preview">
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}
            {onDownload && (
              <button onClick={onDownload} className="p-1.5 rounded-lg hover:bg-secondary" title="Download">
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
            {onReshare && (
              <button onClick={onReshare} className="p-1.5 rounded-lg hover:bg-secondary" title="Share again">
                <Share2 className="w-3.5 h-3.5" />
              </button>
            )}
            {onRevoke && share.status !== "revoked" && (
              <button disabled={busy} onClick={onRevoke} className="text-xs px-2 py-1 rounded-lg text-red-500 hover:bg-red-500/10 disabled:opacity-60">
                Revoke
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
