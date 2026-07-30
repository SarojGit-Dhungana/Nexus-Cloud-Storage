/**
 * Beginner TanStack Query for Friends chat.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { messagingApi } from "../api";

export function useFriendsQuery() {
  return useQuery({
    queryKey: ["messaging", "friends"],
    queryFn: () => messagingApi.friends(),
  });
}

export function useChatHistoryQuery(peerId: string | undefined) {
  return useQuery({
    queryKey: ["messaging", "history", peerId],
    queryFn: () => messagingApi.history(peerId!),
    enabled: Boolean(peerId),
    // Soft poll so new messages show up
    refetchInterval: peerId ? 2000 : false,
  });
}

export function useAddFriendMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => messagingApi.addFriend(userId),
    onSuccess: (friend) => {
      queryClient.invalidateQueries({ queryKey: ["messaging", "friends"] });
      toast.success(`Added ${friend.name}`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not add friend"),
  });
}

export function useSendDirectMessageMutation(peerId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => messagingApi.send(peerId!, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messaging", "history", peerId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Send failed"),
  });
}
