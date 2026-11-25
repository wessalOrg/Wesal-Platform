"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { isProfessionalRole } from "@/lib/account-role";
import { useOptionalUserProfileStore } from "@/components/profile/UserProfileProvider";
import { resolvePublishingLock } from "@/lib/publishing-lock";

const noRefresh = async () => {};

export type AccountPublishingLock = {
  ready: boolean;
  isLocked: boolean;
  lockedUntil: string | null;
  reason: string | null;
  /** Remaining ms for a timed lock; 0 also covers locks without a known deadline. */
  remainingMs: number;
  refresh: () => Promise<void>;
};

/** Publishing restrictions share the same profile snapshot as approval permissions. */
export function useAccountPublishingLock(): AccountPublishingLock {
  const { session, status } = useAuth();
  const store = useOptionalUserProfileStore();
  const professional = session.isAuthenticated && isProfessionalRole(session.role);
  const lock = resolvePublishingLock(professional ? store?.profile ?? null : null);
  return {
    ready: status === "ready" && (!professional || Boolean(store?.profile)),
    ...lock,
    reason: null,
    refresh: store?.refetch ?? noRefresh,
  };
}
