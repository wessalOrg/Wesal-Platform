"use client";

import { useEffect, useState } from "react";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import {
  readProfileAvatar,
  resolveProfileAvatarUserIds,
} from "@/lib/profile-avatar";

type AvatarEventDetail = {
  userId?: string;
  dataUrl?: string | null;
};

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of ids) {
    const id = raw?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function readFirstAvatar(ids: string[]): string | null {
  for (const id of ids) {
    const value = readProfileAvatar(id);
    if (value) return value;
  }
  return null;
}

const avatarIdsCache = new Map<string, string[]>();

function resolveAvatarIds(
  extraUserIds: Array<string | null | undefined>,
  userId: string | null | undefined,
): string[] {
  const key = `${extraUserIds.join("|")}\u0000${userId ?? ""}`;
  const cached = avatarIdsCache.get(key);
  if (cached) return cached;
  const next = uniqueIds([
    ...extraUserIds,
    userId,
    ...resolveProfileAvatarUserIds(extraUserIds[0] ?? null),
  ]);
  avatarIdsCache.set(key, next);
  return next;
}

/**
 * Shared avatar URL for topbars/chips/welcome orbs.
 * Works for seeker + owner by resolving profile id and session ids together.
 */
export function useProfileAvatarUrl(extraUserIds: Array<string | null | undefined> = []) {
  const { authenticated, userId } = useAccountAccess();
  const ids = resolveAvatarIds(extraUserIds, userId);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [prevAuthenticated, setPrevAuthenticated] = useState(authenticated);
  if (prevAuthenticated !== authenticated && !authenticated) {
    setPrevAuthenticated(authenticated);
    setAvatarUrl(null);
  }

  useEffect(() => {
    if (!authenticated) return;

    const refresh = () => setAvatarUrl(readFirstAvatar(ids));
    refresh();

    const onAvatar = (event: Event) => {
      const detail = (event as CustomEvent<AvatarEventDetail>).detail;
      // Re-scan storage so seeker/owner stay in sync across profile + session ids.
      if (!detail?.userId) return;
      refresh();
    };

    window.addEventListener("wesal:profile-avatar", onAvatar);
    return () => window.removeEventListener("wesal:profile-avatar", onAvatar);
  }, [authenticated, ids]);

  return avatarUrl;
}
