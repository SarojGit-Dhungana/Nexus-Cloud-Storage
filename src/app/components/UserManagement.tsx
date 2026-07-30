import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal, Plus, RefreshCw, Search, UserPlus, Users } from "lucide-react";
import { adminApi, ApiUser } from "../api";
import { useConfirm, useFormPrompt } from "../form-modals";
import { AVATAR_COLORS } from "../lib/brand";
import { formatByteCount } from "../lib/format";
import { AppAvatar } from "./AppAvatar";
import { AppBadge } from "./AppBadge";

export function UserManagement() {
  const [search, setSearch] = useState("");
  const colors = AVATAR_COLORS;
  const queryClient = useQueryClient();
  const { promptForm, modal: formModal } = useFormPrompt();
  const { confirm, modal: confirmModal } = useConfirm();
  const { data: users = [] } = useQuery({ queryKey: ["admin", "users"], queryFn: adminApi.users });

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );
  const toggleUser = async (user: ApiUser) => {
    const suspending = user.is_active;
    const ok = await confirm({
      title: suspending ? `Suspend ${user.name}?` : `Activate ${user.name}?`,
      description: suspending
        ? `Are you sure you want to suspend this user? ${user.name} will temporarily lose access to NexusStorage until you activate them again.`
        : `${user.name} will regain access to NexusStorage and can sign in again.`,
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
  const inviteUser = async () => {
    const values = await promptForm({
      title: "Invite user",
      description: "Send an invitation link (valid for 7 days). The link is copied to your clipboard.",
      fields: [{ name: "email", label: "Email address", type: "email", autoFocus: true, placeholder: "you@nexusstorage.local" }],
      confirmLabel: "Create invite",
    });
    const email = values?.email?.trim();
    if (!email) return;
    try {
      const invitation = await adminApi.invite(email);
      await navigator.clipboard.writeText(invitation.invite_url);
      toast.success("Invitation link copied (valid for 7 days)");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invitation failed");
    }
  };

  return (
    <div>
      {formModal}
      {confirmModal}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold">User Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{users.length} users total</p>
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
          <button onClick={inviteUser} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
            <UserPlus className="w-3.5 h-3.5" /> Invite
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
                <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{formatByteCount(u.storage_used)}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">{new Date(u.date_joined).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <AppBadge variant={u.is_active ? "success" : "danger"}>{u.is_active ? "active" : "suspended"}</AppBadge>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleUser(u)}
                    title={u.is_active ? "Suspend user" : "Activate user"}
                    className="p-1 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
