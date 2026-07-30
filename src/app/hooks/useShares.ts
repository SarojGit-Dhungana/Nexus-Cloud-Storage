/**
 * Beginner TanStack Query for the Shared page.
 * useQuery = fetch lists
 * useMutation = accept / ignore / revoke actions
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fileApi } from "../api";

export function useSharedFilesQuery() {
  return useQuery({
    queryKey: ["files", "shared"],
    queryFn: () => fileApi.list("shared"),
  });
}

export function useShareRequestsQuery(
  status?: "pending" | "accepted" | "ignored" | "revoked",
  scope: "inbox" | "sent" = "inbox",
  enabled = true,
) {
  return useQuery({
    queryKey: ["shares", status || "all", scope],
    queryFn: () => fileApi.shareRequests(status, scope),
    enabled,
  });
}

export function useShareRespondMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "accept" | "ignore" | "revoke" }) => {
      if (action === "accept") return fileApi.acceptShare(id);
      if (action === "ignore") return fileApi.ignoreShare(id);
      return fileApi.revokeShare(id);
    },
    onSuccess: (_data, { action }) => {
      // Refresh share lists after a change
      queryClient.invalidateQueries({ queryKey: ["shares"] });
      queryClient.invalidateQueries({ queryKey: ["files", "shared"] });
      queryClient.invalidateQueries({ queryKey: ["files", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success(
        action === "accept"
          ? "Share accepted — you can preview and download"
          : action === "ignore"
            ? "Share request ignored"
            : "Share access removed",
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not update share");
    },
  });
}
