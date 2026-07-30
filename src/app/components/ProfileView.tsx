import { useRef, useState } from "react";
import { toast } from "sonner";
import { HardDrive, History, Key, Loader2, LogOut, QrCode, Shield, ShieldAlert, ShieldCheck, User } from "lucide-react";
import { ApiUser, authApi, clearTokens } from "../api";
import { StorageMeter, useFormPrompt } from "../form-modals";
import { AVATAR_COLORS, BRAND } from "../lib/brand";
import { formatBytes } from "../lib/format";
import type { UserProfile } from "../types/app-types";
import { AppAvatar } from "./AppAvatar";
import { AppBadge } from "./AppBadge";
import { TwoFactorDialog } from "./TwoFactorDialog";

export function ProfileView({ user, onUserUpdate }: { user: UserProfile; onUserUpdate: (user: ApiUser) => void }) {
  const [name, setName] = useState(user.name);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const { promptForm, modal: formModal } = useFormPrompt();

  const saveName = async () => {
    if (!name.trim() || name.trim() === user.name) return;
    setSavingName(true);
    try {
      onUserUpdate(await authApi.updateProfile({ name: name.trim() }));
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = async () => {
    const values = await promptForm({
      title: "Change password",
      description: "Enter your current password and a new password (minimum 8 characters).",
      fields: [
        { name: "current", label: "Current password", type: "password", autoFocus: true },
        { name: "next", label: "New password", type: "password", placeholder: "Minimum 8 characters" },
      ],
      confirmLabel: "Update password",
    });
    if (!values?.current || !values?.next) return;
    try {
      await authApi.changePassword(values.current, values.next);
      toast.success("Password changed — please sign in again");
      clearTokens();
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change password");
    }
  };

  const disableTwoFactor = async () => {
    const values = await promptForm({
      title: "Disable two-factor authentication",
      description: "Confirm with your password and a current authenticator code.",
      fields: [
        { name: "password", label: "Account password", type: "password", autoFocus: true },
        { name: "otp", label: "6-digit authenticator code", placeholder: "000000" },
      ],
      confirmLabel: "Disable 2FA",
      danger: true,
    });
    if (!values?.password || !values?.otp) return;
    try {
      await authApi.disableTwoFactor(values.password, values.otp.replace(/\D/g, ""));
      onUserUpdate(await authApi.me());
      toast.success("Two-factor authentication disabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disable 2FA");
    }
  };

  return (
    <div className="space-y-5">
      {formModal}
      <div>
        <h2 className="font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account, security and storage</p>
      </div>

      {/* Identity card */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-4">
          <AppAvatar initials={user.name.split(" ").map(n => n[0]).join("")} size="lg" />
          <div className="min-w-0">
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <AppBadge variant={user.role === "admin" ? "warning" : "muted"}>{user.role}</AppBadge>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Display name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
          </div>
          <button onClick={saveName} disabled={savingName} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
            {savingName && <Loader2 className="w-4 h-4 animate-spin" />} Save
          </button>
        </div>
      </div>

      {/* Security card */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <h3 className="font-medium">Security</h3>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            {user.twoFactorEnabled
              ? <ShieldCheck className="w-5 h-5 text-emerald-500" />
              : <ShieldAlert className="w-5 h-5 text-amber-500" />}
            <div>
              <p className="text-sm font-medium">Two-factor authentication (Google Authenticator)</p>
              <p className="text-xs text-muted-foreground">
                {user.twoFactorEnabled ? "Enabled — codes required at sign-in" : "Add a second layer of protection with a TOTP app"}
                {user.twoFactorRequired && !user.twoFactorEnabled && " · required by your organization"}
              </p>
            </div>
          </div>
          {user.twoFactorEnabled
            ? <button onClick={disableTwoFactor} className="px-3 py-2 rounded-lg bg-secondary text-xs font-medium hover:bg-red-500 hover:text-white transition-colors">Disable</button>
            : <button onClick={() => setTwoFactorOpen(true)} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"><QrCode className="w-3.5 h-3.5" /> Enable</button>}
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap border-t border-border pt-4">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-muted-foreground">Change your account password</p>
            </div>
          </div>
          <button onClick={changePassword} className="px-3 py-2 rounded-lg bg-secondary text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors">Change</button>
        </div>
      </div>

      {/* Storage card */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <HardDrive className="w-4 h-4 text-primary" />
          <h3 className="font-medium">Storage</h3>
        </div>
        <StorageMeter usedGb={user.storage.used} totalGb={user.storage.total} />
      </div>

      {twoFactorOpen && (
        <TwoFactorDialog onClose={() => setTwoFactorOpen(false)} onDone={async () => onUserUpdate(await authApi.me())} />
      )}
    </div>
  );
}
