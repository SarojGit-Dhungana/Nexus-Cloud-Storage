/**
 * Beginner TanStack Query for Trash.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fileApi } from "../api";

export function useTrashQuery() {
  return useQuery({
    queryKey: ["files", "trash"],
    queryFn: () => fileApi.list("trash"),
  });
}

function useTrashInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["files"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function useRestoreTrashMutation() {
  const refresh = useTrashInvalidate();
  return useMutation({
    mutationFn: (id: string) => fileApi.restore(id),
    onSuccess: () => {
      refresh();
      toast.success("Item restored");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Restore failed"),
  });
}

export function usePermanentDeleteMutation() {
  const refresh = useTrashInvalidate();
  return useMutation({
    mutationFn: (id: string) => fileApi.permanentDelete(id),
    onSuccess: () => {
      refresh();
      toast.success("Permanently deleted");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Delete failed"),
  });
}

export function useEmptyTrashMutation() {
  const refresh = useTrashInvalidate();
  return useMutation({
    mutationFn: () => fileApi.emptyTrash(),
    onSuccess: () => {
      refresh();
      toast.success("Trash emptied");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to empty trash"),
  });
}
