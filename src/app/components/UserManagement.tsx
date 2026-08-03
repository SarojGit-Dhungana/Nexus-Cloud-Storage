import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HardDrive, MoreHorizontal, Search, Trash2, Users } from "lucide-react";
import { adminApi, ApiUser } from "../api";
import { useConfirm, useFormPrompt } from "../form-modals";
import { AVATAR_COLORS } from "../lib/brand";
import { formatByteCount } from "../lib/format";
import { AppAvatar } from "./AppAvatar";
import { AppBadge } from "./AppBadge";

const ROLE_OPTIONS = [
  { value: "user", label: "Member" },
  { value: "admin", label: "Administrator" },
];

export function UserManagement({ currentUserId }: { currentUserId: string }) {
  const [search, setSearch] = useState("");
  const [menuUserId, setMenuUserId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const colors = AVATAR_COLORS;
  const queryClient = useQueryClient();
  const { promptForm, modal: formModal } = useFormPrompt();
  const { confirm, modal: confirmModal } = useConfirm();
  const { data: users = [] } = useQuery({ queryKey: ["admin", "users"], queryFn: adminApi.users });
  const { data: settings } = useQuery({ queryKey: ["admin", "settings"], queryFn: adminApi.settings });

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  /** Regular members can be suspended/deleted; never yourself or other admins. */
  const canManageMember = (target: ApiUser) =>
    target.id !== currentUserId && target.role === "user";

  useEffect(() => {
    if (!menuUserId) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuUserId(null);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuUserId]);

  const allocateUserStorage = async (user: ApiUser) => {
    setMenuUserId(null);
    const orgQuotaGb = (settings?.storage_quota_bytes ?? 0) / 1024 ** 3;
    const usedGb = user.storage_used / 1024 ** 3;
    const currentGb = user.storage_total / 1024 ** 3;
    const isSelf = user.id === currentUserId;
    const values = await promptForm({
      title: isSelf ? "Allocate your storage" : `Allocate storage — ${user.name}`,
      description: isSelf
        ? `Set your personal quota within the workspace (${orgQuotaGb.toFixed(1)} GB total). Currently using ${formatByteCount(user.storage_used)}. Must be between ${Math.max(0.01, usedGb).toFixed(2)} GB and ${orgQuotaGb.toFixed(1)} GB.`
        : `Personal quota within your workspace (${orgQuotaGb.toFixed(1)} GB total). Currently using ${formatByteCount(user.storage_used)}. Must be between ${Math.max(0.01, usedGb).toFixed(2)} GB and ${orgQuotaGb.toFixed(1)} GB.`,
      fields: [{
        name: "storage_gb",
        label: "Personal storage allocation (GB)",
        type: "number",
        defaultValue: String(Math.max(0.1, Math.round(currentGb * 10) / 10) || (user.role === "user" ? 50 : 1)),
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
    if (settings && storageGb * 1024 ** 3 > settings.storage_quota_bytes) {
      toast.error(`Cannot exceed workspace allocation (${orgQuotaGb.toFixed(1)} GB)`);
      return;
    }
    try {
      await adminApi.updateUser(user.id, {
        storage_quota_bytes: Math.round(storageGb * 1024 ** 3),
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(isSelf ? `Your storage set to ${storageGb} GB` : `Allocated ${storageGb} GB to ${user.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update storage allocation");
    }
  };

  const toggleUser = async (user: ApiUser) => {
    setMenuUserId(null);
    if (!canManageMember(user)) {
      toast.error(
        user.id === currentUserId
          ? "You cannot suspend your own account"
          : "Administrators can only suspend regular users",
      );
      return;
    }
    const suspending = user.is_active;
    const ok = await confirm({
      title: suspending ? `Suspend ${user.name}?` : `Activate ${user.name}?`,
      description: suspending
        ? `Are you sure you want to suspend this user? ${user.name} will temporarily lose access to Cloud Based Storage System until you activate them again.`
        : `${user.name} will regain access to Cloud Based Storage System and can sign in again.`,
      confirmLabel: suspending ? "Yes, suspend" : "Yes, activate",
      danger: suspending,
    });
    if (!ok) return;
    try {
      await adminApi.updateUser(user.id, { is_active: !user.is_active });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(suspending ? `${user.name} has been suspended` : `${user.name} is active again`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "User update failed");
    }
  };

  const deleteUser = async (user: ApiUser) => {
    setMenuUserId(null);
    if (!canManageMember(user)) {
      toast.error(
        user.id === currentUserId
          ? "You cannot delete your own account"
          : "Administrators can only delete regular users",
      );
      return;
    }
    const ok = await confirm({
      title: `Delete ${user.name}?`,
      description: `This permanently removes ${user.name} and their files from the workspace. This cannot be undone.`,
      confirmLabel: "Delete user",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminApi.deleteUser(user.id);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "analytics"] });
      toast.success(`${user.name} deleted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete user");
    }
  };

  const addUser = async () => {
    const values = await promptForm({
      title: "Add workspace user",
      description: "Create an account in your workspace. Regular members get 50 GB by default; administrators use the workspace allocation. Share the temporary password securely.",
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

  return (
    <div>
      {formModal}
      {confirmModal}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold">User Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{users.length} users total — allocate storage (including your own), or suspend/delete members</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users…"
              className="pl-9 pr-4 py-2 text-sm rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50 w-52"
            />
          </div>
          <button onClick={addUser} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
            <Users className="w-3.5 h-3.5" /> Add user
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">User</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden sm:table-cell">Role</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden md:table-cell">Storage</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden lg:table-cell">Joined</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((u, i) => (
              <tr key={u.id} className="hover:bg-secondary/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <AppAvatar initials={u.name.split(" ").map(part => part[0]).join("").slice(0, 2)} size="sm" color={colors[i % colors.length]} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <AppBadge variant={u.role === "admin" ? "warning" : "muted"}>{u.role}</AppBadge>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                  {formatByteCount(u.storage_used)} / {formatByteCount(u.storage_total)}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">{new Date(u.date_joined).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <AppBadge variant={u.is_active ? "success" : "danger"}>{u.is_active ? "active" : "suspended"}</AppBadge>
                </td>
                <td className="px-4 py-3">
                  <div className="relative" ref={menuUserId === u.id ? menuRef : undefined}>
                    <button
                      onClick={() => setMenuUserId(menuUserId === u.id ? null : u.id)}
                      title="User actions"
                      className="p-1 rounded-lg hover:bg-secondary transition-colors"
                    >
                      <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                    </button>
                    {menuUserId === u.id && (
                      <div className="absolute right-0 top-8 z-20 w-48 rounded-lg border border-border bg-popover shadow-lg py-1 text-xs">
                        <button
                          onClick={() => allocateUserStorage(u)}
                          className="w-full px-3 py-2 text-left hover:bg-secondary flex items-center gap-2"
                        >
                          <HardDrive className="w-3.5 h-3.5" />
                          {u.id === currentUserId ? "Allocate your storage" : "Allocate storage"}
                        </button>
                        {canManageMember(u) && (
                          <>
                            <button
                              onClick={() => toggleUser(u)}
                              className="w-full px-3 py-2 text-left hover:bg-secondary"
                            >
                              {u.is_active ? "Suspend user" : "Activate user"}
                            </button>
                            <button
                              onClick={() => deleteUser(u)}
                              className="w-full px-3 py-2 text-left hover:bg-secondary text-red-500 flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete user
                            </button>
                          </>
                        )}
                        {!canManageMember(u) && u.id === currentUserId && (
                          <p className="px-3 py-2 text-muted-foreground">
                            You can set your own personal quota above
                          </p>
                        )}
                        {!canManageMember(u) && u.id !== currentUserId && (
                          <p className="px-3 py-2 text-muted-foreground">
                            Admins cannot be suspended or deleted here
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
