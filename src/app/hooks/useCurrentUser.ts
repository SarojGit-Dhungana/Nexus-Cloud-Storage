/**
 * Beginner TanStack Query: load the signed-in user once.
 * useQuery = "get data and keep it fresh"
 */
import { useQuery } from "@tanstack/react-query";
import { ApiError, authApi, clearTokens, Portal, portalForRole } from "../api";

export function useCurrentUser(portal: Portal) {
  return useQuery({
    // Unique key so React Query knows this cache entry
    queryKey: ["auth", "me", portal],
    queryFn: async () => {
      try {
        const apiUser = await authApi.me();
        // Wrong portal for this role → clear token and treat as logged out
        if (portalForRole(apiUser.role) !== portal) {
          clearTokens(portal);
          return null;
        }
        return apiUser;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearTokens(portal);
          return null;
        }
        clearTokens(portal);
        return null;
      }
    },
    retry: false,
  });
}
