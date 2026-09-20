"use client";

import { useEffect, useMemo, useState } from "react";
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

/**
 * Shared avatar URL for topbars/chips/welcome orbs.
 * Works for seeker + owner by resolving profile id and session ids together.
 */
export function useProfileAvatarUrl(extraUserIds: Array<string | null | undefined> = []) {
  const { authenticated, userId } = useAccountAccess();
  const ids = useMemo(
    () =>
      uniqueIds([
        ...extraUserIds,
        userId,
        ...resolveProfileAvatarUserIds(extraUserIds[0] ?? null),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- join keeps identity stable
    [extraUserIds.join("|"), userId],
  );

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) {
      setAvatarUrl(null);
      return;
    }

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
