import { BRAND } from "../lib/brand";
import { cn } from "../lib/format";

export function AppAvatar({ initials, size = "md", color }: { initials: string; size?: "sm" | "md" | "lg"; color?: string }) {
  const s = { sm: "w-7 h-7 text-xs", md: "w-8 h-8 text-sm", lg: "w-10 h-10 text-base" }[size];
  return (
    <div className={cn(s, "rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0")} style={{ background: color || BRAND.brick }}>
      {initials}
    </div>
  );
}
