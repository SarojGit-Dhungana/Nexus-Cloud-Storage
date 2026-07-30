import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Trash, Trash2 } from "lucide-react";
import { fileApi } from "../api";
import { useConfirm } from "../form-modals";
import { getFileIcon, toUiFile } from "../lib/files";
import { cn } from "../lib/format";
import type { FileItem } from "../types/app-types";

export function TrashView() {
  const queryClient = useQueryClient();
  const { confirm, modal: confirmModal } = useConfirm();
  const { data: apiTrash = [] } = useQuery({ queryKey: ["files", "trash"], queryFn: () => fileApi.list("trash") });
  const trash = apiTrash.map(file => ({ ...toUiFile(file), deleted: file.deleted_at ? new Date(file.deleted_at).toLocaleString() : "" }));
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["files"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const restore = async (file: FileItem & { deleted: string }) => {
    const ok = await confirm({
      title: "Restore item?",
      description: `“${file.name}” will be restored to My Files.`,
      confirmLabel: "Restore",
    });
    if (!ok) return;
    try {
      await fileApi.restore(file.id);
      refresh();
      toast.success(`“${file.name}” restored`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Restore failed");
    }
  };

  const permanentlyDelete = async (file: FileItem & { deleted: string }) => {
    const ok = await confirm({
      title: "Delete permanently?",
      description: `“${file.name}” will be permanently deleted. This cannot be undone.`,
      confirmLabel: "Delete forever",
      danger: true,
    });
    if (!ok) return;
    try {
      await fileApi.permanentDelete(file.id);
      refresh();
      toast.success("Permanently deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  };

  const emptyTrash = async () => {
    if (!trash.length) return;
    const ok = await confirm({
      title: "Empty trash?",
      description: `All ${trash.length} item${trash.length === 1 ? "" : "s"} in Trash will be permanently deleted. This cannot be undone.`,
      confirmLabel: "Empty trash",
      danger: true,
    });
    if (!ok) return;
    try {
      await fileApi.emptyTrash();
      refresh();
      toast.success("Trash emptied");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to empty trash");
    }
  };

  return (
    <div>
      {confirmModal}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold">Trash</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Restore files or delete them permanently. Items may be removed after 30 days.
          </p>
        </div>
        {trash.length > 0 && (
          <button onClick={emptyTrash} className="text-xs text-red-500 hover:underline flex items-center gap-1">
            <Trash2 className="w-3.5 h-3.5" /> Empty trash
          </button>
        )}
      </div>

      {trash.length === 0 ? (
        <div className="text-center py-24">
          <Trash2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Trash is empty</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {trash.map((f, i) => (
            <div key={f.id} className={cn("flex items-center gap-4 px-4 py-3 hover:bg-secondary/50 transition-colors", i !== trash.length - 1 && "border-b border-border")}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: f.color + "18" }}>
                {getFileIcon(f.type, f.color)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.name}</p>
                <p className="text-xs text-muted-foreground">Deleted {f.deleted} · {f.size !== "—" ? f.size : f.type}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => restore(f)}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Restore
                </button>
                <button
                  onClick={() => permanentlyDelete(f)}
                  className="text-xs px-2.5 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  Delete forever
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
