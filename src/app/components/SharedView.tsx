/**
 * Shared files page — uses TanStack hooks + small card components.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Download, Eye, Share2 } from "lucide-react";
import { authenticatedDownload, authenticatedPreview } from "../api";
import { useShareRequestsQuery, useShareRespondMutation, useSharedFilesQuery } from "../hooks/useShares";
import { getFileIcon, toUiFile } from "../lib/files";
import { cn } from "../lib/format";
import type { FileItem } from "../types/app-types";
import { AppBadge } from "./AppBadge";
import { ShareDialog } from "./ShareDialog";
import { ShareRequestCard } from "./share/ShareRequestCard";

export function SharedView() {
  const [tab, setTab] = useState<"accepted" | "pending" | "sent">("accepted");
  const [shareModal, setShareModal] = useState<FileItem | null>(null);

  // Beginner pattern: one hook = one list from the API
  const { data: acceptedFiles = [] } = useSharedFilesQuery();
  const { data: pending = [] } = useShareRequestsQuery("pending");
  const { data: acceptedShares = [] } = useShareRequestsQuery("accepted");
  const { data: allShares = [] } = useShareRequestsQuery(undefined, "sent", tab === "sent");
  const respondMutation = useShareRespondMutation();

  const files = acceptedFiles.map(toUiFile);
  const sentByMe = allShares.filter(s => s.status === "pending" || s.status === "accepted");

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold">Shared Items</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Accept share requests, then preview or download documents</p>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          {([
            ["accepted", "Shared with me"],
            ["pending", `Pending${pending.length ? ` (${pending.length})` : ""}`],
            ["sent", "Shared by me"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn("px-3 py-1.5 transition-colors", tab === id ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "pending" && (
        <div className="grid gap-3">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">No pending share requests</p>
          ) : pending.map(share => (
            <ShareRequestCard
              key={share.id}
              share={share}
              mode="pending"
              busy={respondMutation.isPending}
              onAccept={() => respondMutation.mutate({ id: share.id, action: "accept" })}
              onIgnore={() => respondMutation.mutate({ id: share.id, action: "ignore" })}
            />
          ))}
        </div>
      )}

      {tab === "accepted" && (
        <div className="grid gap-3">
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">No accepted shared files yet</p>
          ) : files.map(file => {
            const grant = acceptedShares.find(s => s.file_id === file.id);
            return (
              <div key={file.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-colors group">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: file.color + "18" }}>
                  {getFileIcon(file.type, file.color)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Shared by {file.owner} · {file.modified}</p>
                </div>
                <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  {file.type !== "folder" && (
                    <>
                      <button onClick={() => authenticatedPreview(file.id).catch(error => toast.error(error.message))} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">
                        <Eye className="w-3 h-3" /> Preview
                      </button>
                      <button onClick={() => authenticatedDownload(file.id, file.name).catch(error => toast.error(error.message))} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">
                        <Download className="w-3 h-3" /> Download
                      </button>
                    </>
                  )}
                  {grant && (
                    <button onClick={() => respondMutation.mutate({ id: grant.id, action: "revoke" })} className="text-xs px-2.5 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors">
                      Unaccept
                    </button>
                  )}
                  <button onClick={() => setShareModal(file)} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">
                    <Share2 className="w-3 h-3" /> Manage
                  </button>
                </div>
                <AppBadge variant="muted">{file.type}</AppBadge>
              </div>
            );
          })}
        </div>
      )}

      {tab === "sent" && (
        <div className="grid gap-3">
          {sentByMe.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">You have not shared any items yet</p>
          ) : sentByMe.map(share => (
            <ShareRequestCard
              key={share.id}
              share={share}
              mode="sent"
              busy={respondMutation.isPending}
              onRevoke={() => respondMutation.mutate({ id: share.id, action: "revoke" })}
            />
          ))}
        </div>
      )}

      {shareModal && <ShareDialog file={shareModal} onClose={() => setShareModal(null)} />}
    </div>
  );
}
