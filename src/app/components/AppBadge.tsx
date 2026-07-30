import { cn } from "../lib/format";

export function AppBadge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "danger" | "muted" }) {
  const v = {
    default: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-red-500/10 text-red-500",
    muted: "bg-secondary text-muted-foreground",
  }[variant];
  return <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", v)}>{children}</span>;
}
