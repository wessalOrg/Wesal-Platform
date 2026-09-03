"use client";

import { useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { isUnauthorizedApiError } from "@/lib/api-error";

/**
 * 401 invalidates Lilian's session via AuthProvider.logout.
 * 403 stays on the page; callers map it through the existing service error helpers.
 */
export function useProtectedHallError() {
  const { logout } = useAuth();

  return useCallback(
    async (err: unknown, mapMessage: (error: unknown) => string): Promise<string> => {
      if (isUnauthorizedApiError(err)) {
        await logout({ redirect: false });
      }
      return mapMessage(err);
    },
    [logout],
  );
}
