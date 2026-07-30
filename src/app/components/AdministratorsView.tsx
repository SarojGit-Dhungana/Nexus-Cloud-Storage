import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crown, Plus, RefreshCw, UserPlus } from "lucide-react";
import { superAdminApi, SystemUser } from "../api";
import { useConfirm, useFormPrompt } from "../form-modals";
import { AVATAR_COLORS } from "../lib/brand";
import { cn } from "../lib/format";
import { AppAvatar } from "./AppAvatar";
import { AppBadge } from "./AppBadge";

export function AdministratorsView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", organization: "" });
  const { promptForm, modal: formModal } = useFormPrompt();
  const { confirm, modal: confirmModal } = useConfirm();
  const { data: workspaces = [] } = useQuery({ queryKey: ["system", "workspaces"], queryFn: superAdminApi.workspaces });
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["system", "users"],
    queryFn: () => superAdminApi.users(),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["system"] });
  const filtered = accounts.filter(account =>
    `${account.name} ${account.email} ${account.organization_name || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const createAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await superAdminApi.createAdmin({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        organization: form.organization,
        role: "admin",
      });
      setForm({ name: "", email: "", password: "", organization: "" });
      setCreating(false);
      refresh();
      toast.success("Administrator created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create administrator");
    }
  };

  const changeRole = async (account: SystemUser) => {
    const demoting = account.role === "admin";
    const workspaceLabel = account.organization_name || "their workspace";
    const ok = await confirm({
      title: demoting ? `Demote ${account.name}?` : `Promote ${account.name}?`,
      description: demoting
        ? `Are you sure you want to demote this administrator? ${account.name} will become a regular member of “${workspaceLabel}” and lose admin permissions in NexusStorage.`
        : `Are you sure you want to promote ${account.name}? They will become a workspace administrator for “${workspaceLabel}” and can manage members and settings.`,
      confirmLabel: demoting ? "Yes, demote" : "Yes, promote",
      danger: demoting,
    });
    if (!ok) return;
    try {
      await superAdminApi.updateUser(account.id, { role: demoting ? "user" : "admin" });
      refresh();
      toast.success(demoting ? `${account.name} is now a member` : `${account.name} is now an administrator`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  };

  const toggleActive = async (account: SystemUser) => {
    const suspending = account.is_active;
    const ok = await confirm({
      title: suspending ? `Suspend ${account.name}?` : `Activate ${account.name}?`,
      description: suspending
        ? `Are you sure you want to suspend this account? ${account.name} will temporarily lose access to NexusStorage until you activate them again.`
        : `${account.name} will regain access to NexusStorage and can sign in again.`,
      confirmLabel: suspending ? "Yes, suspend" : "Yes, activate",
      danger: suspending,
    });
    if (!ok) return;
    try {
      await superAdminApi.updateUser(account.id, { is_active: !account.is_active });
      refresh();
      toast.success(suspending ? `${account.name} has been suspended` : `${account.name} is active again`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  };

  const resetPassword = async (account: SystemUser) => {
    const ok = await confirm({
      title: `Reset password for ${account.name}?`,
      description: `This sets a new temporary password for ${account.email}. Share it with them securely and ask them to change it after signing in.`,
      confirmLabel: "Continue",
      danger: true,
    });
    if (!ok) return;

    const values = await promptForm({
      title: "Set temporary password",
      description: `Enter a temporary password for ${account.name} (${account.email}).`,
      fields: [{
        name: "password",
        label: "New temporary password",
        type: "password",
        placeholder: "At least 8 characters",
        autoFocus: true,
      }],
      confirmLabel: "Reset password",
      danger: true,
    });
    if (!values?.password) return;
    try {
      await superAdminApi.updateUser(account.id, { password: values.password });
      toast.success(`Password updated for ${account.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Password reset failed");
    }
  };

  return (
    <div className="space-y-5">
      {formModal}
      {confirmModal}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold">Administrators &amp; members</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Accounts across every workspace</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email or workspace…" className="text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
          <button onClick={() => setCreating(v => !v)} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
            <UserPlus className="w-4 h-4" /> New admin
          </button>
        </div>
      </div>

      {creating && (
        <form onSubmit={createAdmin} className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="font-medium text-sm">Create workspace administrator</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
            <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" className="text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
            <input required type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Temporary password" className="text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
            <select required value={form.organization} onChange={e => setForm({ ...form, organization: e.target.value })} className="text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none">
              <option value="">Select workspace…</option>
              {workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreating(false)} className="px-3 py-2 text-sm rounded-lg hover:bg-secondary">Cancel</button>
            <button type="submit" className="px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90">Create</button>
          </div>
        </form>
      )}

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Loading accounts…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">No matching accounts</p>
        ) : filtered.map((account, index) => (
          <div key={account.id} className={cn("flex items-center gap-4 px-4 py-3.5 flex-wrap", index !== filtered.length - 1 && "border-b border-border")}>
            <AppAvatar initials={account.name.split(" ").map(part => part[0]).join("").slice(0, 2)} color={AVATAR_COLORS[index % AVATAR_COLORS.length]} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{account.name}</p>
              <p className="text-xs text-muted-foreground truncate">{account.email} · {account.organization_name || "no workspace"}</p>
            </div>
            <AppBadge variant={account.role === "admin" ? "warning" : "muted"}>{account.role}</AppBadge>
            <AppBadge variant={account.is_active ? "success" : "danger"}>{account.is_active ? "active" : "suspended"}</AppBadge>
            <div className="flex items-center gap-2">
              <button onClick={() => changeRole(account)} className="text-xs px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">
                {account.role === "admin" ? "Demote" : "Promote"}
              </button>
              <button onClick={() => toggleActive(account)} className="text-xs px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">
                {account.is_active ? "Suspend" : "Activate"}
              </button>
              <button onClick={() => resetPassword(account)} className="text-xs px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">
                Reset password
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
