/**
 * Trash page — TanStack mutations + TrashItemRow component.
 */
import { Trash2 } from "lucide-react";
import { useConfirm } from "../form-modals";
import {
  useEmptyTrashMutation,
  usePermanentDeleteMutation,
  useRestoreTrashMutation,
  useTrashQuery,
} from "../hooks/useTrash";
import { toUiFile } from "../lib/files";
import { TrashItemRow } from "./trash/TrashItemRow";

export function TrashView() {
  const { confirm, modal: confirmModal } = useConfirm();
  const { data: apiTrash = [] } = useTrashQuery();
  const restoreMutation = useRestoreTrashMutation();
  const deleteMutation = usePermanentDeleteMutation();
  const emptyMutation = useEmptyTrashMutation();

  const trash = apiTrash.map(file => ({
    ...toUiFile(file),
    deleted: file.deleted_at ? new Date(file.deleted_at).toLocaleString() : "",
  }));

  const restore = async (file: (typeof trash)[number]) => {
    const ok = await confirm({
      title: "Restore item?",
      description: `"${file.name}" will be restored to My Files.`,
      confirmLabel: "Restore",
    });
    if (ok) restoreMutation.mutate(file.id);
  };

  const permanentlyDelete = async (file: (typeof trash)[number]) => {
    const ok = await confirm({
      title: "Delete permanently?",
      description: `"${file.name}" will be permanently deleted. This cannot be undone.`,
      confirmLabel: "Delete forever",
      danger: true,
    });
    if (ok) deleteMutation.mutate(file.id);
  };

  const emptyTrash = async () => {
    if (!trash.length) return;
    const ok = await confirm({
      title: "Empty trash?",
      description: `All ${trash.length} item${trash.length === 1 ? "" : "s"} in Trash will be permanently deleted. This cannot be undone.`,
      confirmLabel: "Empty trash",
      danger: true,
    });
    if (ok) emptyMutation.mutate();
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
            <TrashItemRow
              key={f.id}
              file={f}
              isLast={i === trash.length - 1}
              onRestore={() => restore(f)}
              onDeleteForever={() => permanentlyDelete(f)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
