import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Download, Eye, Share2, X } from "lucide-react";
import { authenticatedDownload, authenticatedPreview, fileApi } from "../api";
import { BRAND } from "../lib/brand";
import { getFileIcon, toUiFile } from "../lib/files";
import { cn } from "../lib/format";
import type { FileItem, FileType } from "../types/app-types";
import { AppAvatar } from "./AppAvatar";
import { AppBadge } from "./AppBadge";
import { ShareDialog } from "./ShareDialog";

export function SharedView() {
  const [tab, setTab] = useState<"accepted" | "pending" | "sent">("accepted");
  const [shareModal, setShareModal] = useState<FileItem | null>(null);
  const queryClient = useQueryClient();
  const { data: acceptedFiles = [] } = useQuery({
    queryKey: ["files", "shared"],
    queryFn: () => fileApi.list("shared"),
  });
  const { data: pending = [] } = useQuery({
    queryKey: ["shares", "pending"],
    queryFn: () => fileApi.shareRequests("pending"),
  });
  const { data: acceptedShares = [] } = useQuery({
    queryKey: ["shares", "accepted"],
    queryFn: () => fileApi.shareRequests("accepted"),
  });
  const { data: allShares = [] } = useQuery({
    queryKey: ["shares", "sent"],
    queryFn: () => fileApi.shareRequests(undefined, "sent"),
    enabled: tab === "sent",
  });

  const refreshShares = () => {
    queryClient.invalidateQueries({ queryKey: ["shares"] });
    queryClient.invalidateQueries({ queryKey: ["files", "shared"] });
  };

  const respond = async (id: string, action: "accept" | "ignore" | "revoke") => {
    try {
      if (action === "accept") await fileApi.acceptShare(id);
      else if (action === "ignore") await fileApi.ignoreShare(id);
      else await fileApi.revokeShare(id);
      refreshShares();
      toast.success(
        action === "accept" ? "Share accepted — you can preview and download" :
        action === "ignore" ? "Share request ignored" :
        "Share access removed",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update share");
    }
  };

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
            <div key={share.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 flex-wrap">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND.brick + "18" }}>
                {getFileIcon((share.file_type as FileType) || "document", BRAND.brick)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{share.file_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  From {share.sender_name} · {share.permission} access · {new Date(share.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => respond(share.id, "accept")} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90">Accept</button>
                <button onClick={() => respond(share.id, "ignore")} className="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted">Ignore</button>
              </div>
            </div>
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
                    <button onClick={() => respond(grant.id, "revoke")} className="text-xs px-2.5 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors">
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
            <div key={share.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND.ember + "18" }}>
                {getFileIcon((share.file_type as FileType) || "document", BRAND.ember)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{share.file_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  To {share.recipient_email} · {share.permission} · {share.status}
                </p>
              </div>
              <AppBadge variant={share.status === "accepted" ? "warning" : "muted"}>{share.status}</AppBadge>
              {(share.status === "pending" || share.status === "accepted") && (
                <button onClick={() => respond(share.id, "revoke")} className="text-xs px-2.5 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10">
                  Withdraw
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {shareModal && <ShareDialog file={shareModal} onClose={() => setShareModal(null)} />}
    </div>
  );
}
