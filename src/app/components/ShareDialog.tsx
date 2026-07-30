import { useState } from "react";
import { toast } from "sonner";
import { Copy, Globe, Link, Loader2, Mail, X } from "lucide-react";
import { fileApi } from "../api";

export function ShareDialog({ file, onClose }: { file: { id: string; name: string }; onClose: () => void }) {
  const [shareEmail, setShareEmail] = useState("");
  const [expiration, setExpiration] = useState("");
  const [sharePassword, setSharePassword] = useState("");
  const [linkEmail, setLinkEmail] = useState("");
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [busy, setBusy] = useState<"invite" | "link" | null>(null);

  const invitePerson = async () => {
    if (!shareEmail.trim()) return toast.error("Enter an email address");
    setBusy("invite");
    try {
      const result = await fileApi.invite(file.id, shareEmail.trim(), "share");
      toast.success(
        result.email_sent
          ? `Share request emailed to ${shareEmail}`
          : `Share request created for ${shareEmail} — waiting for acceptance`,
      );
      setShareEmail("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sharing failed");
    } finally {
      setBusy(null);
    }
  };

  const createLink = async (copy: boolean) => {
    setBusy("link");
    try {
      const link = await fileApi.createShareLink(file.id, {
        permission: "share",
        expires_at: expiration ? new Date(expiration).toISOString() : null,
        password: sharePassword,
        email: linkEmail.trim() || undefined,
      });
      setCreatedLink(link.url);
      if (copy) await navigator.clipboard.writeText(link.url);
      toast.success(
        link.email_sent
          ? `Secure link emailed to ${linkEmail.trim()}`
          : copy
            ? "Secure link created and copied"
            : "Secure link created",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create link");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-popover border border-border rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold truncate max-w-[20rem]">Share "{file.name}"</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Invite people or create a secure link</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Invite a person by email */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Share with a person (by email)</label>
            <div className="flex gap-2">
              <input value={shareEmail} onChange={e => setShareEmail(e.target.value)} placeholder="you@nexusstorage.local" className="flex-1 text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
              <span className="text-xs px-2 py-2 rounded-lg bg-secondary border border-border text-muted-foreground whitespace-nowrap">Can share</span>
              <button onClick={invitePerson} disabled={busy === "invite"} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1">
                {busy === "invite" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />} Send
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">The person receives an email notification and can open it after signing in.</p>
          </div>

          {/* Secure link options */}
          <div className="pt-1 border-t border-border space-y-3">
            <label className="text-xs font-medium text-muted-foreground block">Secure link</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[11px] text-muted-foreground">Expires on</span>
                <input type="date" value={expiration} onChange={e => setExpiration(e.target.value)} className="w-full mt-1 text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">Password (optional)</span>
                <input type="password" value={sharePassword} onChange={e => setSharePassword(e.target.value)} placeholder="Protect the link" className="w-full mt-1 text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
              </div>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground">Email this link to (optional)</span>
              <input value={linkEmail} onChange={e => setLinkEmail(e.target.value)} placeholder="you@nexusstorage.local" className="w-full mt-1 text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
            </div>
            {createdLink && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary text-xs">
                <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate flex-1">{createdLink}</span>
                <button onClick={() => { navigator.clipboard.writeText(createdLink); toast.success("Copied"); }} className="p-1 rounded hover:bg-background">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => createLink(true)} disabled={busy === "link"} className="flex-1 px-3 py-2 rounded-lg bg-secondary text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5">
                {busy === "link" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link className="w-3 h-3" />} Create &amp; copy link
              </button>
              {linkEmail.trim() && (
                <button onClick={() => createLink(false)} disabled={busy === "link"} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> Email link
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg hover:bg-secondary transition-colors">Done</button>
        </div>
      </div>
    </div>
  );
}
