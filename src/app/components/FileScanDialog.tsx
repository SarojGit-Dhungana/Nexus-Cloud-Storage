import { CheckCircle2, Loader2, ShieldAlert, X } from "lucide-react";
import type { UploadScanProgress } from "../lib/files";

export type { UploadScanProgress };

export function FileScanDialog({
  progress,
  onClose,
}: {
  progress: UploadScanProgress | null;
  onClose: () => void;
}) {
  if (!progress) return null;

  const done = progress.status === "success" || progress.status === "error";
  const step = Math.min(progress.index + 1, progress.total);
  const phaseWeight = progress.status === "uploading" ? 0.5 : progress.status === "scanning" ? 0 : 1;
  const pct =
    progress.total <= 0
      ? 0
      : Math.min(100, Math.round(((progress.index + phaseWeight) / progress.total) * 100));

  const title =
    progress.status === "scanning"
      ? "Scanning file"
      : progress.status === "uploading"
        ? "Uploading file"
        : progress.status === "success"
          ? "Upload complete"
          : "Upload blocked";

  const Icon = progress.status === "error" ? ShieldAlert : CheckCircle2;

  const iconWrap =
    progress.status === "error"
      ? "bg-destructive/10 text-destructive"
      : progress.status === "success"
        ? "bg-primary/10 text-primary"
        : "bg-secondary text-foreground";

  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4">
      <div
        className="bg-popover border border-border rounded-2xl w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconWrap}`}>
            {done ? (
              <Icon className="w-5 h-5" />
            ) : (
              <Loader2 className="w-5 h-5 animate-spin" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1 break-all">
              {progress.fileName || "Preparing…"}
            </p>
          </div>
          {done && (
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          <p
            className={`text-sm ${
              progress.status === "error" ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {progress.message}
          </p>

          {progress.total > 1 && (
            <p className="text-xs text-muted-foreground">
              File {Math.min(step, progress.total)} of {progress.total}
            </p>
          )}

          <div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progress.status === "error" ? "bg-destructive" : "bg-primary"
                }`}
                style={{ width: `${progress.status === "error" ? Math.max(pct, 8) : progress.status === "success" ? 100 : Math.max(pct, 8)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground text-right">
              {progress.status === "success" ? "100%" : `${pct}%`}
            </p>
          </div>
        </div>

        {done && (
          <div className="p-4 border-t border-border flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90"
            >
              {progress.status === "error" ? "Got it" : "Done"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
