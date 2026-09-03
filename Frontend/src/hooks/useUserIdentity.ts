"use client";

import { useOptionalUserProfileStore } from "@/components/profile/UserProfileProvider";
import { useAccountAccess } from "@/hooks/useAccountAccess";

/**
 * Single read model for Regular User identity across navbar, profile, and forms.
 * Hall Owner consumers still get session/stub fields only — this hook never
 * invents owner-profile state.
 */
export function useUserIdentity() {
  const account = useAccountAccess();
  const store = useOptionalUserProfileStore();
  const profile = account.canOpenRegularProfile ? store?.profile ?? null : null;

  return {
    ready: account.ready,
    authenticated: account.authenticated,
    role: account.role,
    isHallOwner: account.isHallOwner,
    canOpenRegularProfile: account.canOpenRegularProfile,
    displayName: profile?.fullName ?? account.displayName,
    email: profile?.email ?? account.email,
    phoneNumber: profile?.phoneNumber ?? account.phoneNumber,
    profile,
    logout: account.logout,
  };
}
