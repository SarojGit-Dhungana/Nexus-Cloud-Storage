import { useEffect, useState } from "react";
import { Check, Cloud, Loader2, Lock, RefreshCw, Shield } from "lucide-react";
import { cn } from "../lib/format";

export const BOOT_STEPS = ["Establishing secure channel", "Restoring your session", "Preparing workspace"];
export const BOOT_DURATION_MS = 1900;

export function WorkspaceLoader() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setStep(current => Math.min(current + 1, BOOT_STEPS.length - 1)),
      BOOT_DURATION_MS / (BOOT_STEPS.length + 0.5),
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    // Loading screen — soft color blobs, no square grid
    <div className="relative h-screen overflow-hidden bg-background flex items-center justify-center font-sans">
      <div className="absolute inset-0 nexus-boot-glow" aria-hidden="true" />
      <div className="nexus-auth-orbit nexus-auth-orbit--a" aria-hidden="true" />
      <div className="nexus-auth-orbit nexus-auth-orbit--b" aria-hidden="true" />
      <div className="absolute top-0 inset-x-0 h-[3px] z-20 bg-gradient-to-r from-[#145A32] via-[#145A32] to-[#FF0000]" />

      <div className="relative z-10 w-full max-w-sm px-8">
        <div className="flex flex-col items-center text-center">
          <div className="relative w-16 h-16 mb-5">
            <span className="absolute -inset-2 rounded-xl bg-primary/25 blur-xl nexus-boot-ring" />
            <div className="relative w-16 h-16 rounded-xl nexus-mark flex items-center justify-center">
              <Cloud className="w-7 h-7 text-white" />
            </div>
          </div>
          <span className="font-brand text-[1.85rem] text-foreground">NexusStorage</span>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-primary">System online</p>
          <p className="mt-2 text-sm text-muted-foreground">Initializing secure workspace channels</p>
        </div>

        <div className="mt-8 h-1 rounded-full bg-secondary overflow-hidden">
          <div className="h-full nexus-boot-bar" />
        </div>

        <ul className="mt-6 space-y-2.5">
          {BOOT_STEPS.map((label, index) => (
            <li
              key={label}
              className={cn(
                "flex items-center gap-2.5 text-xs font-medium tracking-wide transition-colors duration-300",
                index <= step ? "text-foreground" : "text-muted-foreground/50",
              )}
            >
              {index < step ? (
                <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              ) : index === step ? (
                <RefreshCw className="w-3.5 h-3.5 text-destructive animate-spin flex-shrink-0" />
              ) : (
                <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                </span>
              )}
              {label}
            </li>
          ))}
        </ul>

        <p className="mt-9 flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <Lock className="w-3 h-3" />
          Encrypted transport · Org-isolated
        </p>
      </div>
    </div>
  );
}
