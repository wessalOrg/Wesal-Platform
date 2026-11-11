"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
  fetchNotificationsUnreadCount,
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
let unreadInflight: Promise<number> | null = null;

function refreshUnreadCountFromServer(): Promise<number> {
  if (unreadInflight) return unreadInflight;
  unreadInflight = fetchNotificationsUnreadCount()
    .catch(() => -1)
    .finally(() => {
      unreadInflight = null;
    });
  return unreadInflight;
}

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
  const [serverUnreadCount, setServerUnreadCount] = useState<number | null>(null);

  const items = useMemo(
    () => (snapshot ? listPlatformNotifications(audience) : []),
    [audience, snapshot],
  );

  const localUnreadCount = useMemo(
    () => items.filter((item) => !item.is_read).length,
    [items],
  );
  const unreadCount =
    serverUnreadCount != null && serverUnreadCount >= 0
      ? serverUnreadCount
      : localUnreadCount;

  useEffect(() => {
    const token = getAccessToken();
    if (!token || token.startsWith("stub-") || notificationsUseMock()) {
      setServerUnreadCount(null);
      return;
    }
    const fresh =
      hydration?.token === token && Date.now() - hydration.at < HYDRATION_TTL_MS;
    if (fresh) {
      void refreshUnreadCountFromServer().then((count) => {
        if (count >= 0) setServerUnreadCount(count);
      });
      return;
    }
    hydration = { token, at: Date.now() };
    void refreshNotificationsFromServer().then(() =>
      refreshUnreadCountFromServer().then((count) => {
        if (count >= 0) setServerUnreadCount(count);
      }),
    );
  }, [identity.isAdmin, identity.isHallOwner]);

  const markRead = useCallback((id: string) => {
    markPlatformNotificationRead(id);
    setServerUnreadCount((prev) =>
      prev != null && prev > 0 ? prev - 1 : prev,
    );
    if (isServerNotificationId(id)) {
      void markServerNotificationRead(id)
        .then(() => refreshUnreadCountFromServer())
        .then((count) => {
          if (count >= 0) setServerUnreadCount(count);
        })
        .catch(() => undefined);
    }
  }, []);

  const markAllRead = useCallback(() => {
    markPlatformNotificationsRead(audience);
    setServerUnreadCount(0);
    if (!notificationsUseMock()) {
      void markAllServerNotificationsRead()
        .then(() => refreshUnreadCountFromServer())
        .then((count) => {
          if (count >= 0) setServerUnreadCount(count);
        })
        .catch(() => undefined);
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
