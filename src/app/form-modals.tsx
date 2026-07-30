import { FormEvent, useCallback, useState } from "react";
import { HardDrive, Loader2, X } from "lucide-react";

export type FormField = {
  name: string;
  label: string;
  type?: "text" | "password" | "email" | "number" | "select";
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  autoFocus?: boolean;
  options?: { value: string; label: string }[];
};

type FormPromptOptions = {
  title: string;
  description?: string;
  fields: FormField[];
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** When set, the field named here must exactly equal this value. */
  requireExact?: { field: string; value: string; mismatchMessage?: string };
};

type FormPromptState = FormPromptOptions & {
  resolve: (values: Record<string, string> | null) => void;
};

type NoticeState = {
  title: string;
  description: string;
  confirmLabel?: string;
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function storagePercent(used: number, total: number) {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, (used / total) * 100));
}

export function isStorageFull(storage: { used: number; total: number }) {
  return storage.total > 0 && storage.used >= storage.total - 1e-9;
}

/** `used`/`total` are in GB (same as UserProfile.storage). */
export function wouldExceedStorage(storage: { used: number; total: number }, incomingBytes: number) {
  if (storage.total <= 0) return false;
  if (isStorageFull(storage)) return true;
  const remainingBytes = Math.max(0, (storage.total - storage.used) * 1024 ** 3);
  return incomingBytes > remainingBytes;
}

export function StorageMeter({
  usedGb,
  totalGb,
  compact = false,
}: {
  usedGb: number;
  totalGb: number;
  compact?: boolean;
}) {
  const pct = storagePercent(usedGb, totalGb);
  const full = isStorageFull({ used: usedGb, total: totalGb });
  const warn = pct >= 90;
  const barColor = full ? "bg-destructive" : warn ? "bg-amber-500" : "bg-primary";
  const freeLabel = full ? "Storage full" : `${(100 - pct).toFixed(0)}% free`;

  return (
    <div>
      <div className={cn("flex justify-between mb-1.5", compact ? "text-xs" : "text-sm")}>
        <span className="text-muted-foreground">Storage</span>
        <span className={cn("font-medium", full && "text-destructive")}>
          {usedGb.toFixed(1)} GB / {totalGb.toFixed(1)} GB
        </span>
      </div>
      <div className={cn("rounded-full bg-secondary overflow-hidden", compact ? "h-1.5" : "h-2")}>
        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
      </div>
      <p className={cn("mt-1.5 text-muted-foreground", compact ? "text-xs" : "text-xs", full && "text-destructive font-medium")}>
        {freeLabel}
      </p>
    </div>
  );
}

export function StorageFullNotice({
  open,
  usedLabel,
  totalLabel,
  onClose,
}: {
  open: boolean;
  usedLabel: string;
  totalLabel: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-popover border border-border rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
            <HardDrive className="w-5 h-5 text-destructive" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">Storage allocation full</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your allocated storage ({usedLabel} of {totalLabel}) is full. Delete files or ask an administrator to increase the quota before uploading more data.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function FormModal({
  state,
  onClose,
  onSubmit,
}: {
  state: FormPromptState;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(state.fields.map(f => [f.name, f.defaultValue ?? ""])),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (state.requireExact) {
      const actual = (values[state.requireExact.field] || "").trim();
      if (actual !== state.requireExact.value) {
        setError(state.requireExact.mismatchMessage || "Confirmation text did not match");
        return;
      }
    }
    setBusy(true);
    try {
      onSubmit(values);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        className="bg-popover border border-border rounded-2xl w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{state.title}</h3>
            {state.description && <p className="text-sm text-muted-foreground mt-1">{state.description}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {state.fields.map(field => (
            <div key={field.name}>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{field.label}</label>
              {field.type === "select" ? (
                <select
                  autoFocus={field.autoFocus}
                  required={field.required !== false}
                  value={values[field.name] ?? ""}
                  onChange={e => setValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-full text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50"
                >
                  {(field.options || []).map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  autoFocus={field.autoFocus}
                  type={field.type || "text"}
                  required={field.required !== false}
                  value={values[field.name] ?? ""}
                  placeholder={field.placeholder}
                  onChange={e => setValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-full text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50"
                />
              )}
            </div>
          ))}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg hover:bg-secondary">
            {state.cancelLabel || "Cancel"}
          </button>
          <button
            type="submit"
            disabled={busy}
            className={cn(
              "px-4 py-2 text-sm rounded-lg font-medium disabled:opacity-60 flex items-center gap-2",
              state.danger
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {state.confirmLabel || "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function useFormPrompt() {
  const [state, setState] = useState<FormPromptState | null>(null);

  const promptForm = useCallback((options: FormPromptOptions) => {
    return new Promise<Record<string, string> | null>(resolve => {
      setState({ ...options, resolve });
    });
  }, []);

  const close = useCallback(() => {
    setState(current => {
      current?.resolve(null);
      return null;
    });
  }, []);

  const submit = useCallback((values: Record<string, string>) => {
    setState(current => {
      current?.resolve(values);
      return null;
    });
  }, []);

  const modal = state ? <FormModal state={state} onClose={close} onSubmit={submit} /> : null;

  return { promptForm, modal };
}

export function useConfirm() {
  const [state, setState] = useState<{
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    resolve: (ok: boolean) => void;
  } | null>(null);

  const confirm = useCallback(
    (options: {
      title: string;
      description?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      danger?: boolean;
    }) => {
      return new Promise<boolean>(resolve => {
        setState({ ...options, resolve });
      });
    },
    [],
  );

  const close = useCallback((ok: boolean) => {
    setState(current => {
      current?.resolve(ok);
      return null;
    });
  }, []);

  const modal = state ? (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4" onClick={() => close(false)}>
      <div className="bg-popover border border-border rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{state.title}</h3>
            {state.description && <p className="text-sm text-muted-foreground mt-1">{state.description}</p>}
          </div>
          <button type="button" onClick={() => close(false)} className="p-1.5 rounded-lg hover:bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 flex justify-end gap-2">
          <button type="button" onClick={() => close(false)} className="px-4 py-2 text-sm rounded-lg hover:bg-secondary">
            {state.cancelLabel || "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className={cn(
              "px-4 py-2 text-sm rounded-lg font-medium",
              state.danger
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {state.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, modal };
}

export function useNotice() {
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const showNotice = useCallback((next: NoticeState) => setNotice(next), []);
  const closeNotice = useCallback(() => setNotice(null), []);

  const modal = notice ? (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4" onClick={closeNotice}>
      <div className="bg-popover border border-border rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{notice.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{notice.description}</p>
          </div>
          <button type="button" onClick={closeNotice} className="p-1.5 rounded-lg hover:bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 flex justify-end">
          <button onClick={closeNotice} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90">
            {notice.confirmLabel || "Got it"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { showNotice, modal };
}
