"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import { getAccessToken } from "@/lib/auth-token";
import {
  isServerNotificationId,
  listPlatformNotifications,
  markPlatformNotificationRead,
  markPlatformNotificationsRead,
  readPlatformNotificationsSnapshot,
  replacePlatformNotifications,
  subscribePlatformNotifications,
} from "@/lib/platform-notifications-store";
import { resolveNotificationActionUrl } from "@/lib/platform-notification-routes";
import {
  fetchServerNotifications,
  markAllServerNotificationsRead,
  markServerNotificationRead,
  notificationsUseMock,
} from "@/services/notifications";
import type {
  NotificationAudience,
  PlatformNotification,
} from "@/types/platform-notification";

const HYDRATION_TTL_MS = 30_000;

let hydration: { token: string; at: number } | null = null;
let inflight: Promise<void> | null = null;

/**
 * Pulls the durable inbox into the local feed. Concurrent callers (the navbar bell and a
 * notifications page can mount together) share one request, and a fresh hydration for the
 * same session is skipped for a short window so opening/closing the panel does not refetch.
 */
function refreshNotificationsFromServer(): Promise<void> {
  if (inflight) return inflight;
  inflight = fetchServerNotifications()
    .then((items) => replacePlatformNotifications(items))
    .catch(() => undefined)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function audienceFromIdentity(identity: {
  isAdmin: boolean;
  isHallOwner: boolean;
}): NotificationAudience {
  if (identity.isAdmin) return "admin";
  if (identity.isHallOwner) return "owner";
  return "seeker";
}

export function useNotifications(audienceOverride?: NotificationAudience) {
  const identity = useUserIdentity();
  const router = useRouter();
  const audience = audienceOverride ?? audienceFromIdentity(identity);
  // Subscribe to the localStorage-backed store; the serialized snapshot changes
  // whenever notifications are pushed / marked read (same tab or another tab).
  const snapshot = useSyncExternalStore(
    subscribePlatformNotifications,
    readPlatformNotificationsSnapshot,
    () => "",
  );

  const items = useMemo(
    () => (snapshot ? listPlatformNotifications(audience) : []),
    [audience, snapshot],
  );

  const unreadCount = useMemo(
    () => items.filter((item) => !item.is_read).length,
    [items],
  );

  useEffect(() => {
    const token = getAccessToken();
    if (!token || token.startsWith("stub-") || notificationsUseMock()) return;
    const fresh =
      hydration?.token === token && Date.now() - hydration.at < HYDRATION_TTL_MS;
    if (fresh) return;
    hydration = { token, at: Date.now() };
    void refreshNotificationsFromServer();
  }, [identity.isAdmin, identity.isHallOwner]);

  const markRead = useCallback((id: string) => {
    markPlatformNotificationRead(id);
    if (isServerNotificationId(id)) {
      void markServerNotificationRead(id).catch(() => undefined);
    }
  }, []);

  const markAllRead = useCallback(() => {
    markPlatformNotificationsRead(audience);
    if (!notificationsUseMock()) {
      void markAllServerNotificationsRead().catch(() => undefined);
    }
  }, [audience]);

  const openNotification = useCallback(
    (item: PlatformNotification) => {
      markRead(item.id);
      const href = resolveNotificationActionUrl(
        item.type,
        item.metadata,
        item.action_url,
        item.audience,
      );
      if (href) router.push(href);
    },
    [markRead, router],
  );

  return {
    audience,
    items,
    unreadCount,
    hasUnread: unreadCount > 0,
    markRead,
    markAllRead,
    openNotification,
  };
}
