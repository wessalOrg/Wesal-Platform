"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { canAccessRegularProfile, isHallOwnerRole } from "@/lib/account-role";
import { getStoredAuth } from "@/lib/auth-storage";
import { getAccessToken } from "@/lib/auth-token";

/**
 * Session API is the real gate. Stored auth is only used for display fields
 * (id/email/phone) until profile APIs fill them in.
 */
export function useAccountAccess() {
  const { session, status, logout: logoutSession } = useAuth();
  const stored = typeof window === "undefined" ? null : getStoredAuth();

  const ready = status === "ready";
  const authenticated = session.isAuthenticated;
  const accessToken = getAccessToken();
  const sessionKey =
    ready && authenticated
      ? stored?.user?.id?.trim() || accessToken || stored?.token || "session"
      : null;
  const displayName = session.userName?.trim() || stored?.user?.name?.trim() || null;
  const email = stored?.user?.email?.trim() || null;
  const phoneNumber = stored?.user?.phone?.trim() || null;
  const role = session.role;
  const isHallOwner = isHallOwnerRole(role);
  const canOpenRegularProfile = canAccessRegularProfile(authenticated, role);

  const logout = async () => {
    await logoutSession();
  };

  return {
    ready,
    authenticated,
    sessionKey,
    userId: stored?.user?.id?.trim() || null,
    displayName,
    email,
    phoneNumber,
    role,
    isHallOwner,
    canOpenRegularProfile,
    logout,
  };
}
