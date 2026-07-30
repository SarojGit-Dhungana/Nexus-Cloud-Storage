import { Upload } from "lucide-react";

export function DropOverlay({ active, label = "Drop files to upload" }: { active: boolean; label?: string }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-[2px]">
      <div className="mx-6 w-full max-w-md rounded-xl border-2 border-dashed border-primary bg-card/95 p-8 text-center shadow-xl nexus-drop-pulse">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
          <Upload className="h-6 w-6 text-primary" />
        </div>
        <p className="font-display text-2xl text-foreground">{label}</p>
        <p className="font-hand mt-2 text-sm text-muted-foreground">Release to add them to your workspace</p>
      </div>
    </div>
  );
}
