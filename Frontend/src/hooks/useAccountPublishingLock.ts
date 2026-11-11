"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { isProfessionalRole } from "@/lib/account-role";
import { fetchProfile } from "@/services/profile";

export type AccountPublishingLock = {
  ready: boolean;
  isLocked: boolean;
  lockedUntil: string | null;
  reason: string | null;
  /** Remaining ms until unlock; 0 when unlocked. */
  remainingMs: number;
  refresh: () => Promise<void>;
};

function remainingUntil(iso: string | null | undefined): number {
  if (!iso?.trim()) return 0;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, end - Date.now());
}

/**
 * Reads GET /profile `isLocked` / `lockedUntil` for professionals and
 * auto-clears the UI lock when the restriction window expires.
 */
export function useAccountPublishingLock(): AccountPublishingLock {
  const { session } = useAuth();
  const [ready, setReady] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);

  const refresh = useCallback(async () => {
    if (!session.isAuthenticated || !isProfessionalRole(session.role)) {
      setIsLocked(false);
      setLockedUntil(null);
      setReason(null);
      setRemainingMs(0);
      setReady(true);
      return;
    }
    try {
      const profile = await fetchProfile(session.userName);
      const until = profile.lockedUntil ?? null;
      const left = remainingUntil(until);
      const locked = Boolean(profile.isLocked) && left > 0;
      setIsLocked(locked);
      setLockedUntil(locked ? until : null);
      setReason(null);
      setRemainingMs(locked ? left : 0);
    } catch {
      setIsLocked(false);
      setLockedUntil(null);
      setReason(null);
      setRemainingMs(0);
    } finally {
      setReady(true);
    }
  }, [session.isAuthenticated, session.role, session.userName]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isLocked || remainingMs <= 0) return;
    const timer = window.setTimeout(() => {
      setIsLocked(false);
      setLockedUntil(null);
      setReason(null);
      setRemainingMs(0);
      void refresh();
    }, Math.min(remainingMs + 250, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [isLocked, remainingMs, refresh]);

  return { ready, isLocked, lockedUntil, reason, remainingMs, refresh };
}
