import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Crown, Database, HardDrive, Plus, ShieldAlert } from "lucide-react";
import { superAdminApi, Workspace } from "../api";
import { StorageMeter, useConfirm, useFormPrompt } from "../form-modals";
import { BRAND } from "../lib/brand";
import { cn, formatByteCount } from "../lib/format";
import { AppBadge } from "./AppBadge";
import { StatCard } from "./StatCard";

const DEFAULT_QUOTA_GB = 100;

export function WorkspacesView() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    admin_name: "",
    admin_email: "",
    admin_password: "",
    storage_gb: String(DEFAULT_QUOTA_GB),
  });
  const { promptForm, modal: formModal } = useFormPrompt();
  const { confirm, modal: confirmModal } = useConfirm();
  const { data: overview } = useQuery({ queryKey: ["system", "overview"], queryFn: superAdminApi.overview });
  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ["system", "workspaces"],
    queryFn: superAdminApi.workspaces,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["system"] });

  const createWorkspace = async (event: React.FormEvent) => {
    event.preventDefault();
    const storageGb = Number(form.storage_gb);
    if (!Number.isFinite(storageGb) || storageGb <= 0) {
      toast.error("Storage allocation must be greater than 0 GB");
      return;
    }
    try {
      await superAdminApi.createWorkspace({
        name: form.name.trim(),
        storage_quota_bytes: Math.round(storageGb * 1024 ** 3),
        admin_name: form.admin_name.trim() || undefined,
        admin_email: form.admin_email.trim() || undefined,
        admin_password: form.admin_password || undefined,
      });
      setForm({
        name: "",
        admin_name: "",
        admin_email: "",
        admin_password: "",
        storage_gb: String(DEFAULT_QUOTA_GB),
      });
      setCreating(false);
      refresh();
      toast.success("Workspace created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create workspace");
    }
  };

  const allocateStorage = async (workspace: Workspace) => {
    const usedGb = (workspace.storage_used || 0) / 1024 ** 3;
    const currentGb = workspace.storage_quota_bytes / 1024 ** 3;
    const values = await promptForm({
      title: `Allocate storage — ${workspace.name}`,
      description: `Total storage for this workspace and its admin. Currently using ${formatByteCount(workspace.storage_used || 0)}. New allocation must be at least ${usedGb.toFixed(2)} GB. Personal member quotas are set by the workspace admin.`,
      fields: [{
        name: "storage_gb",
        label: "Storage allocation (GB)",
        type: "number",
        defaultValue: String(Math.max(1, Math.round(currentGb * 10) / 10)),
        autoFocus: true,
      }],
      confirmLabel: "Save allocation",
    });
    if (!values?.storage_gb) return;
    const storageGb = Number(values.storage_gb);
    if (!Number.isFinite(storageGb) || storageGb <= 0) {
      toast.error("Storage allocation must be greater than 0 GB");
      return;
    }
    if (storageGb < usedGb) {
      toast.error(`Allocation cannot be below current usage (${usedGb.toFixed(2)} GB)`);
      return;
    }
    try {
      await superAdminApi.updateWorkspace(workspace.id, {
        storage_quota_bytes: Math.round(storageGb * 1024 ** 3),
      });
      refresh();
      toast.success(`Allocated ${storageGb} GB to “${workspace.name}”`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update storage allocation");
    }
  };

  const toggleActive = async (workspace: Workspace) => {
    const suspending = workspace.is_active;
    const ok = await confirm({
      title: suspending ? `Suspend “${workspace.name}”?` : `Reactivate “${workspace.name}”?`,
      description: suspending
        ? `Members of this workspace will temporarily lose access to Cloud Based Storage System until you reactivate it.`
        : `Members of “${workspace.name}” will be able to sign in and use Cloud Based Storage System again.`,
      confirmLabel: suspending ? "Yes, suspend" : "Yes, reactivate",
      danger: suspending,
    });
    if (!ok) return;
    try {
      await superAdminApi.updateWorkspace(workspace.id, { is_active: !workspace.is_active });
      refresh();
      toast.success(suspending ? `“${workspace.name}” is now suspended` : `“${workspace.name}” is active again`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  };

  const removeWorkspace = async (workspace: Workspace) => {
    const values = await promptForm({
      title: "Delete workspace",
      description: `This permanently deletes "${workspace.name}" and all its files.`,
      fields: [{ name: "confirmation", label: `Type "${workspace.name}" to confirm`, autoFocus: true }],
      confirmLabel: "Delete workspace",
      danger: true,
      requireExact: { field: "confirmation", value: workspace.name, mismatchMessage: "Workspace name did not match" },
    });
    if (!values) return;
    try {
      await superAdminApi.deleteWorkspace(workspace.id);
      refresh();
      toast.success("Workspace deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-5">
      {formModal}
      {confirmModal}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold">Workspaces</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Every organization in the system</p>
        </div>
        <button onClick={() => setCreating(v => !v)} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> New workspace
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Workspaces" value={String(overview?.workspaces ?? 0)} delta="total" deltaType="up" icon={Building2} iconColor={BRAND.brick} />
        <StatCard label="Suspended" value={String(overview?.suspended_workspaces ?? 0)} delta="live" deltaType="down" icon={ShieldAlert} iconColor={BRAND.maroon} />
        <StatCard label="Administrators" value={String(overview?.admins ?? 0)} delta="all tenants" deltaType="up" icon={Crown} iconColor={BRAND.ember} />
        <StatCard label="Total Storage" value={formatByteCount(overview?.storage_used ?? 0)} delta="live" deltaType="up" icon={Database} iconColor={BRAND.clay} />
      </div>

      {creating && (
        <form onSubmit={createWorkspace} className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="font-medium text-sm">Create workspace</h3>
          <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Workspace name" className="w-full text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Storage allocation (GB)</label>
            <input
              required
              type="number"
              min={1}
              step="any"
              value={form.storage_gb}
              onChange={e => setForm({ ...form, storage_gb: e.target.value })}
              className="w-full text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50"
            />
          </div>
          <p className="text-xs text-muted-foreground">Optionally create its first administrator now.</p>
          <div className="grid sm:grid-cols-3 gap-2">
            <input value={form.admin_name} onChange={e => setForm({ ...form, admin_name: e.target.value })} placeholder="Admin name" className="text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
            <input type="email" value={form.admin_email} onChange={e => setForm({ ...form, admin_email: e.target.value })} placeholder="Admin email" className="text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
            <input type="password" value={form.admin_password} onChange={e => setForm({ ...form, admin_password: e.target.value })} placeholder="Temp password" className="text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreating(false)} className="px-3 py-2 text-sm rounded-lg hover:bg-secondary">Cancel</button>
            <button type="submit" className="px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90">Create</button>
          </div>
        </form>
      )}

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Loading workspaces…</p>
        ) : workspaces.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">No workspaces yet</p>
        ) : workspaces.map((workspace, index) => {
          const used = workspace.storage_used || 0;
          const quota = workspace.storage_quota_bytes || 0;
          return (
            <div key={workspace.id} className={cn("flex items-center gap-4 px-4 py-3.5 flex-wrap", index !== workspaces.length - 1 && "border-b border-border")}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND.brick + "18" }}>
                <Building2 className="w-4 h-4" style={{ color: BRAND.brick }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{workspace.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {workspace.slug} · {workspace.user_count} users · {workspace.admin_count} admins
                </p>
                <div className="mt-2 max-w-xs">
                  <StorageMeter usedGb={used / 1024 ** 3} totalGb={quota / 1024 ** 3} compact />
                </div>
              </div>
              <AppBadge variant={workspace.is_active ? "success" : "danger"}>{workspace.is_active ? "active" : "suspended"}</AppBadge>
              <div className="flex items-center gap-2">
                <button onClick={() => allocateStorage(workspace)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">
                  <HardDrive className="w-3.5 h-3.5" /> Allocate
                </button>
                <button onClick={() => toggleActive(workspace)} className="text-xs px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">
                  {workspace.is_active ? "Suspend" : "Reactivate"}
                </button>
                <button onClick={() => removeWorkspace(workspace)} className="text-xs px-2.5 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
