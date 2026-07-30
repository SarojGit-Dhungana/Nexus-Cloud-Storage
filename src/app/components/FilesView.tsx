import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity, ArrowUpRight, Check, ChevronRight, Copy, Download, Eye, FileText, Folder, FolderOpen,
  Grid3X3, History, Home, Link, List, Lock, MoreHorizontal, Move, Plus, Search, Share2, Star,
  Trash, Upload, X,
} from "lucide-react";
import { authenticatedDownload, authenticatedPreview, fileApi } from "../api";
import { useConfirm, useFormPrompt } from "../form-modals";
import { hasExternalFiles, useExternalFileDrop } from "../hooks/useExternalFileDrop";
import { useUploadGuard } from "../hooks/useUploadGuard";
import { ACTIVITY_COLORS, BRAND } from "../lib/brand";
import { NEXUS_FILE_MIME, getFileIcon, toUiFile } from "../lib/files";
import { cn } from "../lib/format";
import type { FileItem, ViewMode } from "../types/app-types";
import { DropOverlay } from "./DropOverlay";
import { ShareDialog } from "./ShareDialog";

type FolderCrumb = { id: string; name: string };

export function EncryptedAuditRow({
  log,
  compact = false,
}: {
  log: { id: string; user: string; action: string; file_name: string; timestamp: string; encrypted?: boolean; type?: string };
  compact?: boolean;
}) {
  const sealed = Boolean(log.encrypted) || String(log.action || "").startsWith("enc://");
  return (
    <div className={cn("flex gap-3 items-start", compact ? "px-4 py-3" : "px-4 py-3.5 items-center")}>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: (ACTIVITY_COLORS[log.type || ""] || BRAND.bark) + "18" }}
      >
        {sealed ? <Lock className="w-3.5 h-3.5 text-primary" /> : <Activity className="w-3.5 h-3.5 text-primary" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{log.user}</p>
        {sealed ? (
          <div className="mt-1 space-y-1">
            <p className="text-[11px] font-mono tracking-wide text-muted-foreground truncate flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-primary/80">action</span>
              {log.action}
            </p>
            <p className="text-[11px] font-mono tracking-wide text-muted-foreground truncate flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-primary/80">target</span>
              {log.file_name}
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground truncate">{String(log.action).replaceAll("_", " ")}</p>
            <p className="text-xs font-medium truncate">{log.file_name}</p>
          </>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground flex-shrink-0 pt-0.5">{new Date(log.timestamp).toLocaleString()}</span>
    </div>
  );
}

export function FilesView() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileItem } | null>(null);
  const [sortBy, setSortBy] = useState("modified");
  const [filter, setFilter] = useState("all");
  const [shareTarget, setShareTarget] = useState<FileItem | null>(null);
  const [folderStack, setFolderStack] = useState<FolderCrumb[]>([]);
  const [dropTargetFolder, setDropTargetFolder] = useState<string | null>(null);
  const [draggingFileId, setDraggingFileId] = useState<string | null>(null);
  const { upload, storageFull } = useUploadGuard();
  const { promptForm, modal: formModal } = useFormPrompt();
  const { confirm, modal: confirmModal } = useConfirm();
  const queryClient = useQueryClient();
  const currentFolderId = folderStack.length ? folderStack[folderStack.length - 1].id : null;
  const parentParam = currentFolderId || "root";
  const { data: apiFiles = [], isLoading } = useQuery({
    queryKey: ["files", "mine", parentParam],
    queryFn: () => fileApi.list("mine", { parent: parentParam }),
  });
  const files = apiFiles.map(toUiFile);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["files"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const uploadFiles = useCallback(async (incoming: File[], intoFolderId?: string | null) => {
    if (!incoming.length) return;
    const parent = intoFolderId === undefined ? currentFolderId || undefined : intoFolderId || undefined;
    await upload(incoming, parent);
  }, [currentFolderId, upload]);

  const drop = useExternalFileDrop(uploadFiles);

  const openFolder = (folder: FileItem) => {
    if (folder.type !== "folder") return;
    setFolderStack(stack => [...stack, { id: folder.id, name: folder.name }]);
    setSelected(new Set());
    setFilter("all");
  };

  const goToCrumb = (index: number) => {
    setFolderStack(stack => (index < 0 ? [] : stack.slice(0, index + 1)));
    setSelected(new Set());
  };

  const moveFileToFolder = async (fileId: string, folderId: string | null) => {
    try {
      await fileApi.update(fileId, { parent: folderId });
      refresh();
      toast.success(folderId ? "Moved into folder" : "Moved to root");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Move failed");
    } finally {
      setDropTargetFolder(null);
      setDraggingFileId(null);
    }
  };

  useEffect(() => {
    const close = () => setContextMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const handleContext = (e: React.MouseEvent, file: FileItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const trashFiles = async (ids: string[]) => {
    if (!ids.length) return;
    const count = ids.length;
    const label = count === 1
      ? (files.find(f => f.id === ids[0])?.name || "this item")
      : `${count} items`;
    const ok = await confirm({
      title: "Move to trash?",
      description: `“${label}” will be moved to Trash. You can restore it later from Trash.`,
      confirmLabel: "Move to trash",
      danger: true,
    });
    if (!ok) return;
    try {
      await Promise.all(ids.map(id => fileApi.trash(id)));
      setSelected(new Set());
      refresh();
      toast.success(count === 1 ? "Moved to trash" : `${count} items moved to trash`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  };

  const downloadFiles = async (ids: string[]) => {
    try {
      for (const id of ids) {
        const file = files.find(item => item.id === id);
        if (file?.type !== "folder") await authenticatedDownload(id, file?.name || "download");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    }
  };

  const handleMenuAction = async (label: string, file: FileItem) => {
    setContextMenu(null);
    try {
      if (label === "Open") openFolder(file);
      else if (label === "Preview") await authenticatedPreview(file.id);
      else if (label === "Download") await authenticatedDownload(file.id, file.name);
      else if (label === "Star" || label === "Unstar") {
        await fileApi.update(file.id, { starred: !file.starred });
        refresh();
      } else if (label === "Share…") {
        setShareTarget(file);
      } else if (label === "Copy link") {
        const link = await fileApi.createShareLink(file.id, { permission: "view" });
        await navigator.clipboard.writeText(link.url);
        toast.success("Secure link copied");
      } else if (label === "Rename") {
        const values = await promptForm({
          title: "Rename",
          description: "Enter a new name for this item.",
          fields: [{ name: "name", label: "New name", defaultValue: file.name, autoFocus: true }],
          confirmLabel: "Rename",
        });
        const name = values?.name?.trim();
        if (name && name !== file.name) {
          await fileApi.update(file.id, { name });
          refresh();
          toast.success("Renamed");
        }
      } else if (label === "Duplicate") {
        await fileApi.duplicate(file.id);
        refresh();
        toast.success("Duplicated");
      } else if (label === "Move up") {
        const parentId = folderStack.length > 1 ? folderStack[folderStack.length - 2].id : null;
        await moveFileToFolder(file.id, parentId);
      } else if (label === "Move to…") {
        const folderOptions = files.filter(item => item.type === "folder" && item.id !== file.id);
        const values = await promptForm({
          title: "Move to folder",
          description: folderOptions.length
            ? `Type a folder name from this view, or leave blank to move up/to root.`
            : "Leave blank to move to root / parent. No folders in this view.",
          fields: [{ name: "folder", label: "Folder name", defaultValue: "", required: false, autoFocus: true, placeholder: "Blank = root / parent" }],
          confirmLabel: "Move",
        });
        if (values) {
          const folderName = values.folder?.trim();
          if (!folderName) {
            await moveFileToFolder(file.id, folderStack.length > 1 ? folderStack[folderStack.length - 2].id : null);
          } else {
            const folder = files.find(item => item.type === "folder" && item.name.toLowerCase() === folderName.toLowerCase());
            if (!folder) throw new Error("Folder not found in this location");
            await moveFileToFolder(file.id, folder.id);
          }
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `${label} failed`);
    }
  };

  const filtered = files
    .filter(f => filter === "all" || f.type === filter || (filter === "starred" && f.starred))
    .sort((a, b) => {
      if (a.type === "folder" && b.type !== "folder") return -1;
      if (b.type === "folder" && a.type !== "folder") return 1;
      return sortBy === "name" ? a.name.localeCompare(b.name) : b.modified.localeCompare(a.modified);
    });

  const bindDrag = (file: FileItem) => ({
    draggable: true as const,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(NEXUS_FILE_MIME, file.id);
      e.dataTransfer.effectAllowed = "move";
      setDraggingFileId(file.id);
    },
    onDragEnd: () => { setDraggingFileId(null); setDropTargetFolder(null); },
    onDragOver: (e: React.DragEvent) => {
      if (file.type !== "folder" || draggingFileId === file.id) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      setDropTargetFolder(file.id);
    },
    onDragLeave: () => {
      if (dropTargetFolder === file.id) setDropTargetFolder(null);
    },
    onDrop: async (e: React.DragEvent) => {
      if (file.type !== "folder") return;
      e.preventDefault();
      e.stopPropagation();
      const draggedId = e.dataTransfer.getData(NEXUS_FILE_MIME);
      if (draggedId && draggedId !== file.id) await moveFileToFolder(draggedId, file.id);
      else if (hasExternalFiles(e)) await uploadFiles(Array.from(e.dataTransfer.files), file.id);
      setDropTargetFolder(null);
    },
  });

  return (
    <div className="relative space-y-4" {...(storageFull ? {} : drop.handlers)}>
      <DropOverlay active={drop.active} label={currentFolderId ? "Drop files into this folder" : "Drop files into My Files"} />
      {formModal}
      {confirmModal}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-2xl">My Files</h2>
          <p className="font-hand text-sm text-muted-foreground mt-1">
            {currentFolderId ? `Inside ${folderStack[folderStack.length - 1].name}` : "Browse, organize, and upload"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const values = await promptForm({
                title: "New folder",
                fields: [{ name: "name", label: "Folder name", autoFocus: true }],
                confirmLabel: "Create",
              });
              const name = values?.name?.trim();
              if (!name) return;
              try {
                await fileApi.createFolder(name, currentFolderId || undefined);
                refresh();
                toast.success("Folder created");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to create folder");
              }
            }}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-primary text-primary-foreground"
          >
            <Plus className="w-3.5 h-3.5" /> New folder
          </button>
          <label
            className={cn(
              "flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border cursor-pointer",
              storageFull ? "border-destructive/40 text-destructive bg-destructive/5" : "border-border bg-card hover:bg-secondary",
            )}
            onClick={event => {
              if (!storageFull) return;
              event.preventDefault();
              void upload([]);
            }}
          >
            <Upload className="w-3.5 h-3.5" /> {storageFull ? "Storage full" : "Upload"}
            <input type="file" multiple className="hidden" disabled={storageFull} onChange={e => uploadFiles(Array.from(e.target.files || []))} />
          </label>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 flex-wrap text-sm bg-card border border-border rounded-xl px-3 py-2">
        <button
          onClick={() => goToCrumb(-1)}
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors",
            !folderStack.length ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          <Home className="w-3.5 h-3.5" /> Root
        </button>
        {folderStack.map((crumb, index) => (
          <div key={crumb.id} className="inline-flex items-center gap-1">
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
            <button
              onClick={() => goToCrumb(index)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors max-w-[160px]",
                index === folderStack.length - 1 ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{crumb.name}</span>
            </button>
          </div>
        ))}
        {folderStack.length > 0 && (
          <button
            onClick={() => goToCrumb(folderStack.length - 2)}
            className="ml-auto text-xs text-primary hover:underline px-2"
          >
            Up one level
          </button>
        )}
      </nav>

      <div
        className={cn(
          "rounded-xl border-2 border-dashed p-5 text-center transition-all",
          drop.active ? "border-primary bg-accent" : "border-border bg-card/60 hover:border-primary/35",
        )}
      >
        <p className="font-display text-lg">{drop.active ? "Release to upload here" : "Drag files into this folder"}</p>
        <p className="font-hand text-sm text-muted-foreground mt-1">
          Drop onto a subfolder to nest them · double-click a folder to open it
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
          {[
            { id: "all", label: "All" },
            { id: "folder", label: "Folders" },
            { id: "image", label: "Images" },
            { id: "document", label: "Docs" },
            { id: "starred", label: "Starred" },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn("px-3 py-1.5 text-xs rounded-md font-medium transition-colors", filter === f.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {selected.size > 0 && (
            <div className="flex items-center gap-1 mr-2">
              <span className="text-xs text-muted-foreground">{selected.size} selected</span>
              <button onClick={() => downloadFiles([...selected])} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Download"><Download className="w-3.5 h-3.5" /></button>
              <button onClick={() => trashFiles([...selected])} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-red-500" title="Delete"><Trash className="w-3.5 h-3.5" /></button>
              <button onClick={() => setSelected(new Set())} className="p-1.5 rounded-lg hover:bg-secondary transition-colors"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-card">
            <option value="modified">Recently modified</option><option value="name">Name</option>
          </select>
          <button onClick={() => setViewMode("grid")} className={cn("p-2 rounded-lg transition-colors", viewMode === "grid" ? "bg-secondary" : "hover:bg-secondary")}>
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode("list")} className={cn("p-2 rounded-lg transition-colors", viewMode === "list" ? "bg-secondary" : "hover:bg-secondary")}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading files…</div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-border rounded-2xl bg-card/40">
          <FolderOpen className="w-10 h-10 text-muted-foreground/35 mx-auto mb-3" />
          <p className="font-display text-xl">This folder is empty</p>
          <p className="font-hand text-sm text-muted-foreground mt-1">Upload files or create a subfolder to get started</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map(file => (
            <div
              key={file.id}
              {...bindDrag(file)}
              onContextMenu={e => handleContext(e, file)}
              onClick={() => toggleSelect(file.id)}
              onDoubleClick={() => (file.type === "folder" ? openFolder(file) : authenticatedPreview(file.id).catch(err => toast.error(err.message)))}
              className={cn(
                "bg-card border rounded-xl p-4 cursor-pointer group relative transition-all duration-150 hover:shadow-md",
                selected.has(file.id) ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/30",
                draggingFileId === file.id && "opacity-50",
                dropTargetFolder === file.id && "border-primary bg-accent ring-2 ring-primary/25 scale-[1.02]",
              )}
            >
              {selected.has(file.id) && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: file.color + "18" }}>
                {getFileIcon(file.type, file.color)}
              </div>
              <p className="text-xs font-medium truncate mb-1">{file.name}</p>
              <p className="text-[10px] text-muted-foreground">{file.type === "folder" ? "Folder · double-click to open" : file.modified}</p>
              <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                {file.starred && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                {file.shared && <Share2 className="w-3 h-3 text-primary" />}
              </div>
              {dropTargetFolder === file.id && (
                <p className="absolute inset-x-2 bottom-2 rounded-md bg-primary/90 px-2 py-1 text-[10px] font-medium text-primary-foreground">
                  Drop to move here
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden sm:table-cell">Size</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden md:table-cell">Modified</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden lg:table-cell">Owner</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(file => (
                <tr
                  key={file.id}
                  {...bindDrag(file)}
                  onContextMenu={e => handleContext(e, file)}
                  onClick={() => toggleSelect(file.id)}
                  onDoubleClick={() => (file.type === "folder" ? openFolder(file) : authenticatedPreview(file.id).catch(err => toast.error(err.message)))}
                  className={cn(
                    "cursor-pointer transition-colors",
                    selected.has(file.id) ? "bg-accent/50" : "hover:bg-secondary/50",
                    draggingFileId === file.id && "opacity-50",
                    dropTargetFolder === file.id && "bg-accent ring-1 ring-inset ring-primary/40",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: file.color + "18" }}>
                        {getFileIcon(file.type, file.color)}
                      </div>
                      <span className="text-sm font-medium truncate max-w-[180px]">{file.name}</span>
                      {file.starred && <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
                      {file.shared && <Share2 className="w-3 h-3 text-primary flex-shrink-0" />}
                      {dropTargetFolder === file.id && <span className="text-[10px] text-primary font-medium">Drop here</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">{file.type === "folder" ? "—" : file.size}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{file.modified}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">{file.owner}</td>
                  <td className="px-4 py-3">
                    {file.type === "folder" ? (
                      <button
                        onClick={e => { e.stopPropagation(); openFolder(file); }}
                        className="p-1 rounded-lg hover:bg-secondary transition-colors"
                        title="Open folder"
                      >
                        <FolderOpen className="w-4 h-4 text-primary" />
                      </button>
                    ) : (
                      <button className="p-1 rounded-lg hover:bg-secondary transition-colors">
                        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {contextMenu && (
        <div
          className="fixed z-50 w-48 bg-popover border border-border rounded-xl shadow-xl overflow-hidden py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          {[
            ...(contextMenu.file.type === "folder" ? [{ icon: FolderOpen, label: "Open" }] : [{ icon: Eye, label: "Preview" }]),
            { icon: Download, label: "Download" },
            { icon: Share2, label: "Share…" },
            { icon: Link, label: "Copy link" },
            { icon: FileText, label: "Rename" },
            { icon: Star, label: contextMenu.file.starred ? "Unstar" : "Star" },
            { icon: Copy, label: "Duplicate" },
            { icon: Move, label: "Move to…" },
            ...(folderStack.length ? [{ icon: ArrowUpRight, label: "Move up" }] : []),
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              onClick={() => handleMenuAction(label, contextMenu.file)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-secondary transition-colors"
            >
              <Icon className="w-3.5 h-3.5 text-muted-foreground" />
              {label}
            </button>
          ))}
          <div className="border-t border-border mt-1 pt-1">
            <button
              onClick={() => { setContextMenu(null); trashFiles([contextMenu.file.id]); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <Trash className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>
      )}

      {shareTarget && <ShareDialog file={shareTarget} onClose={() => setShareTarget(null)} />}
    </div>
  );
}
