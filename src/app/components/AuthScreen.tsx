import { useState } from "react";
import { toast } from "sonner";
import { Cloud } from "lucide-react";
import { ApiUser, authApi, Portal, portalForRole, portalLabel, PortalMismatchError } from "../api";
import { PRODUCT_NAME } from "../lib/brand";

export function AuthScreen({
  portal,
  onAuthenticated,
}: {
  portal: Portal;
  onAuthenticated: (user: ApiUser) => void;
}) {
  const [mode, setMode] = useState<"login" | "organization" | "user">(
    portal === "admin" ? "login" : portal === "user" ? "login" : "login",
  );
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const user = mode === "organization"
        ? await authApi.register({
            name,
            email,
            password,
            account_type: "organization",
            organization_name: organization,
          })
        : mode === "user"
        ? await authApi.register({
            name,
            email,
            password,
            account_type: "user",
            organization_slug: organizationSlug,
          })
        : await authApi.login(email, password, otp);

      const expected = portalForRole(user.role);
      if (expected !== portal) {
        toast.error(`Use the ${portalLabel(expected)} portal for this account`);
        return;
      }
      onAuthenticated(user);
      toast.success(
        mode === "organization"
          ? "Workspace created"
          : mode === "user"
          ? "Account created"
          : "Welcome back",
      );
    } catch (error) {
      if (error instanceof PortalMismatchError) {
        toast.error(error.message);
      } else {
        toast.error(error instanceof Error ? error.message : "Authentication failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "organization"
    ? "Create your workspace"
    : mode === "user"
    ? "Create a user account"
    : `${portalLabel(portal)} sign in`;
  const subtitle = mode === "organization"
    ? "You become the organization administrator"
    : mode === "user"
    ? "Join an existing organization as a regular user"
    : portal === "system"
    ? "System console — manage workspaces and administrators"
    : portal === "admin"
    ? "Organization administrator portal"
    : "Member portal — files, sharing, and AI assistant";

  return (
    // Login page — soft blobs behind a solid white form card
    <div className="relative min-h-screen overflow-hidden bg-background flex items-center justify-center p-6 animate-in fade-in duration-500">
      <div className="absolute inset-0 nexus-boot-glow" aria-hidden="true" />
      <div className="nexus-auth-orbit nexus-auth-orbit--a" aria-hidden="true" />
      <div className="nexus-auth-orbit nexus-auth-orbit--b" aria-hidden="true" />
      <div className="absolute top-0 inset-x-0 h-[3px] z-20 bg-gradient-to-r from-[#145A32] via-[#145A32] to-[#FF0000]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-lg nexus-mark flex items-center justify-center">
              <Cloud className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-brand text-[1.25rem] sm:text-[1.45rem] text-foreground leading-tight">{PRODUCT_NAME}</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-destructive mb-3">Access control</p>
          <h1 className="font-display text-[2rem] mb-2 text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <form onSubmit={submit} className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-lg">
          {mode !== "login" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Your name</label>
              <input required value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
            </div>
          )}
          {mode === "organization" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Organization name</label>
              <input required value={organization} onChange={e => setOrganization(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
            </div>
          )}
          {mode === "user" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Organization slug</label>
              <input required value={organizationSlug} onChange={e => setOrganizationSlug(e.target.value.toLowerCase().trim())} placeholder="Cloud Based Storage System" className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
              <p className="text-[11px] text-muted-foreground mt-1">
                Use the slug from Settings. If the admin turned off self-registration, ask them to add your account.
              </p>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Email</label>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Password</label>
            <input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
          </div>
          {mode === "login" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Authenticator code <span className="font-normal">(if enabled)</span></label>
              <input inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
            </div>
          )}
          <button disabled={loading} className="w-full py-2.5 rounded-md bg-primary text-primary-foreground font-semibold uppercase tracking-[0.08em] text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {loading
              ? "Please wait…"
              : mode === "organization"
              ? "Create workspace"
              : mode === "user"
              ? "Create user account"
              : "Sign in"}
          </button>
          <div className="space-y-2 text-center">
            {mode !== "login" && (
              <button type="button" onClick={() => setMode("login")} className="block w-full text-sm text-primary hover:underline">
                Already have an account? Sign in
              </button>
            )}
            {portal === "admin" && mode !== "organization" && (
              <button type="button" onClick={() => setMode("organization")} className="block w-full text-sm text-primary hover:underline">
                New organization? Create as admin
              </button>
            )}
            {portal === "user" && mode !== "user" && (
              <button type="button" onClick={() => setMode("user")} className="block w-full text-sm text-primary hover:underline">
                Join an organization as a user
              </button>
            )}
            <a href="/" className="block w-full text-xs text-muted-foreground hover:text-primary hover:underline">
              Switch portal
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
