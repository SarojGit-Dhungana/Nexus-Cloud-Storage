/** One trash row — restore or delete forever. */
import { RefreshCw, Trash } from "lucide-react";
import { getFileIcon } from "../../lib/files";
import { cn } from "../../lib/format";
import type { FileItem } from "../../types/app-types";

type TrashFile = FileItem & { deleted: string };

export function TrashItemRow({
  file,
  isLast,
  onRestore,
  onDeleteForever,
}: {
  file: TrashFile;
  isLast: boolean;
  onRestore: () => void;
  onDeleteForever: () => void;
}) {
  return (
    <div className={cn("flex items-center gap-4 px-4 py-3 hover:bg-secondary/50 transition-colors", !isLast && "border-b border-border")}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: file.color + "18" }}>
        {getFileIcon(file.type, file.color)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <p className="text-xs text-muted-foreground">Deleted {file.deleted}</p>
      </div>
      <button onClick={onRestore} className="text-xs px-2 py-1 rounded-lg hover:bg-secondary flex items-center gap-1">
        <RefreshCw className="w-3 h-3" /> Restore
      </button>
      <button onClick={onDeleteForever} className="text-xs px-2 py-1 rounded-lg text-red-500 hover:bg-red-500/10 flex items-center gap-1">
        <Trash className="w-3 h-3" /> Delete
      </button>
    </div>
  );
}
