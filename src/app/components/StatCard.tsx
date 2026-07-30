import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "../lib/format";

export function StatCard({ label, value, delta, deltaType, icon: Icon, iconColor }: {
  label: string; value: string; delta: string; deltaType: "up" | "down";
  icon: React.ElementType; iconColor: string;
}) {
  return (
    <div className="bg-card rounded-lg border border-border p-5 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: iconColor }} />
      <div className="flex items-start justify-between mb-4">
        <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: iconColor + "18" }}>
          <Icon className="w-4.5 h-4.5" style={{ color: iconColor }} />
        </div>
        <div className={cn("flex items-center gap-1 text-xs font-semibold uppercase tracking-wider", deltaType === "up" ? "text-primary" : "text-destructive")}>
          {deltaType === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {delta}
        </div>
      </div>
      <p className="font-display text-[1.85rem] tracking-tight">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
