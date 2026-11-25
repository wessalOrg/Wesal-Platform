import type { UserProfile } from "@/types/profile";

type LockFields = Pick<UserProfile, "isLocked" | "lockedUntil">;

/** Only a known finite deadline can expire a restriction locally. */
export function resolvePublishingLock(profile: LockFields | null, now = Date.now()) {
  const until = profile?.lockedUntil?.trim() || null;
  const end = until ? Date.parse(until) : NaN;
  const remainingMs = Number.isFinite(end) ? Math.max(0, end - now) : 0;
  const isLocked = Boolean(profile?.isLocked) && (!Number.isFinite(end) || remainingMs > 0);
  return { isLocked, lockedUntil: isLocked ? until : null, remainingMs: isLocked ? remainingMs : 0 };
}

export function normalizePublishingLock(profile: UserProfile, now = Date.now()): UserProfile {
  const lock = resolvePublishingLock(profile, now);
  return profile.isLocked === lock.isLocked && profile.lockedUntil === lock.lockedUntil
    ? profile : { ...profile, isLocked: lock.isLocked, lockedUntil: lock.lockedUntil };
}
