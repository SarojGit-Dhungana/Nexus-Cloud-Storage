import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, Users } from "lucide-react";
import { adminApi, dashboardApi, OrganizationSettings } from "../api";
import { StorageMeter, useFormPrompt } from "../form-modals";
import { cn } from "../lib/format";

const ROLE_OPTIONS = [
  { value: "user", label: "Member" },
  { value: "admin", label: "Administrator" },
];

export function SystemSettings() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["admin", "settings"], queryFn: adminApi.settings });
  const { data: analytics } = useQuery({ queryKey: ["admin", "analytics"], queryFn: dashboardApi.admin });
  const { data: users = [] } = useQuery({ queryKey: ["admin", "users"], queryFn: adminApi.users });
  const { promptForm, modal: formModal } = useFormPrompt();
  const [organizationName, setOrganizationName] = useState("");
  const [maxFileSize, setMaxFileSize] = useState(500);
  useEffect(() => {
    if (!settings) return;
    setOrganizationName(settings.name);
    setMaxFileSize(settings.max_file_size_bytes / 1024 ** 2);
  }, [settings]);
  const toggles = {
    twoFactor: settings?.require_two_factor ?? false,
    auditLog: settings?.audit_logging ?? false,
    autoBackup: settings?.automatic_backups ?? false,
    emailNotifs: settings?.email_notifications ?? false,
    apiAccess: settings?.api_access ?? false,
    maintenanceMode: settings?.maintenance_mode ?? false,
    selfRegistration: settings?.allow_self_registration ?? true,
  };
  const fieldMap: Record<keyof typeof toggles, keyof OrganizationSettings> = {
    twoFactor: "require_two_factor", auditLog: "audit_logging", autoBackup: "automatic_backups",
    emailNotifs: "email_notifications", apiAccess: "api_access", maintenanceMode: "maintenance_mode",
    selfRegistration: "allow_self_registration",
  };
  const toggle = async (key: keyof typeof toggles, label: string) => {
    try {
      const nextValue = !toggles[key];
      const updated = await adminApi.updateSettings({ [fieldMap[key]]: nextValue });
      queryClient.setQueryData(["admin", "settings"], updated);
      toast.success(
        key === "selfRegistration"
          ? (nextValue
            ? "Users can join with your organization slug"
            : "Self-registration is off — only invite links work")
          : `${label} ${nextValue ? "enabled" : "disabled"}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Settings update failed");
    }
  };
  const saveGeneral = async () => {
    try {
      await adminApi.updateSettings({
        name: organizationName,
        max_file_size_bytes: Math.round(maxFileSize * 1024 ** 2),
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      toast.success("Settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Settings update failed");
    }
  };
  const addUser = async () => {
    const values = await promptForm({
      title: "Add workspace user",
      description: "Create an account in your workspace. Share the temporary password securely.",
      fields: [
        { name: "name", label: "Full name", autoFocus: true, placeholder: "Jane Doe" },
        { name: "email", label: "Email address", type: "email", placeholder: "jane@company.com" },
        { name: "password", label: "Temporary password", type: "password", placeholder: "At least 8 characters" },
        { name: "role", label: "Role", type: "select", options: ROLE_OPTIONS, defaultValue: "user" },
      ],
      confirmLabel: "Add user",
    });
    if (!values?.name?.trim() || !values?.email?.trim() || !values?.password) return;
    try {
      const created = await adminApi.createUser({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        role: values.role === "admin" ? "admin" : "user",
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(`${created.name} added to your workspace`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add user");
    }
  };
  const inviteUser = async () => {
    const values = await promptForm({
      title: "Invite user",
      description: "Send an invitation link (valid for 7 days). The link is copied to your clipboard.",
      fields: [
        { name: "email", label: "Email address", type: "email", autoFocus: true, placeholder: "you@nexusstorage.local" },
        { name: "role", label: "Role", type: "select", options: ROLE_OPTIONS, defaultValue: "user" },
      ],
      confirmLabel: "Create invite",
    });
    const email = values?.email?.trim();
    if (!email) return;
    try {
      const invitation = await adminApi.invite(email, values.role === "admin" ? "admin" : "user");
      await navigator.clipboard.writeText(invitation.invite_url);
      toast.success(
        invitation.email_sent
          ? `Invitation emailed to ${email} (link also copied)`
          : "Invitation link copied (valid for 7 days)",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invitation failed");
    }
  };
  const clearOrganizationData = async () => {
    const values = await promptForm({
      title: "Clear all organization data",
      description: "This permanently removes files, activity, and chats for this workspace.",
      fields: [
        { name: "confirmation", label: `Type "${organizationName}" to confirm`, autoFocus: true },
        { name: "password", label: "Your account password", type: "password" },
      ],
      confirmLabel: "Clear all data",
      danger: true,
      requireExact: {
        field: "confirmation",
        value: organizationName,
        mismatchMessage: "Organization name did not match",
      },
    });
    if (!values?.password) return;
    try {
      await adminApi.clearOrganizationData(values.confirmation, values.password);
      queryClient.clear();
      toast.success("Organization data cleared");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to clear organization data");
    }
  };

  const ToggleRow = ({ id, label, desc }: { id: keyof typeof toggles; label: string; desc: string }) => (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => toggle(id, label)}
        className={cn("relative w-10 h-5 rounded-full transition-colors", toggles[id] ? "bg-primary" : "bg-secondary")}
      >
        <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", toggles[id] && "translate-x-5")} />
      </button>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      {formModal}
      <div>
        <h2 className="font-semibold">System Settings</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Configure your NexusStorage instance</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold mb-1">Workspace members</h3>
            <p className="text-xs text-muted-foreground">
              Add people to your workspace or send an invite link. {users.length} member{users.length === 1 ? "" : "s"} currently.
            </p>
          </div>
          <Users className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addUser}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add user
          </button>
          <button
            type="button"
            onClick={inviteUser}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-border hover:bg-secondary transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" /> Invite by email
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold mb-1">General</h3>
        <p className="text-xs text-muted-foreground mb-4">Basic system configuration</p>
        <div className="space-y-4">
          <div><label className="text-xs font-medium text-muted-foreground block mb-1.5">Organization name</label><input value={organizationName} onChange={e => setOrganizationName(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg bg-secondary border border-border" /></div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Organization slug</label>
            <div className="flex gap-2">
              <input readOnly value={settings?.slug || ""} className="flex-1 text-sm px-3 py-2 rounded-lg bg-secondary border border-border" />
              <button type="button" onClick={() => { if (settings?.slug) { navigator.clipboard.writeText(settings.slug); toast.success("Slug copied"); } }} className="text-xs px-3 py-2 rounded-lg bg-primary text-primary-foreground">Copy</button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Users need this slug to create a regular account in your workspace.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Organization storage limit</label>
            <input
              readOnly
              value={settings ? `${(settings.storage_quota_bytes / 1024 ** 3).toFixed(1)} GB` : "—"}
              className="w-full text-sm px-3 py-2 rounded-lg bg-secondary border border-border"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Allocated by the system super admin. Contact them to request more storage.</p>
            {settings && (
              <div className="mt-3">
                <StorageMeter
                  usedGb={(analytics?.total_storage ?? 0) / 1024 ** 3}
                  totalGb={settings.storage_quota_bytes / 1024 ** 3}
                  compact
                />
              </div>
            )}
          </div>
          <div><label className="text-xs font-medium text-muted-foreground block mb-1.5">Max file size (MB)</label><input type="number" value={maxFileSize} onChange={e => setMaxFileSize(Number(e.target.value))} className="w-full text-sm px-3 py-2 rounded-lg bg-secondary border border-border" /></div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold mb-1">Security & Access</h3>
        <p className="text-xs text-muted-foreground mb-4">Authentication and access control settings</p>
        <ToggleRow id="twoFactor" label="Two-factor authentication" desc="Ask users to enable 2FA (you must enable it on your account first)" />
        <ToggleRow id="selfRegistration" label="Allow user self-registration" desc="When off, people can only join through an invite link — the organization slug alone will be rejected" />
        <ToggleRow id="auditLog" label="Audit logging" desc="Log all user actions for compliance" />
        <ToggleRow id="apiAccess" label="API access" desc="Allow API key generation" />
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold mb-1">Notifications & Backup</h3>
        <p className="text-xs text-muted-foreground mb-4">Automated tasks and alerts</p>
        <ToggleRow id="autoBackup" label="Automatic backups" desc="Daily backups at 2:00 AM UTC" />
        <ToggleRow id="emailNotifs" label="Email notifications" desc="Send digest emails to admins" />
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold mb-1 text-red-500">Danger Zone</h3>
        <p className="text-xs text-muted-foreground mb-4">Irreversible and destructive actions</p>
        <ToggleRow id="maintenanceMode" label="Maintenance mode" desc="Lock all user access except admins" />
        <div className="flex gap-2 mt-4 pt-4 border-t border-border">
          <button onClick={clearOrganizationData} className="text-sm px-4 py-2 rounded-lg border border-red-500/50 text-red-500 hover:bg-red-500/10 transition-colors">
            Clear all data
          </button>
          <button onClick={saveGeneral} className="text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors ml-auto">
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
