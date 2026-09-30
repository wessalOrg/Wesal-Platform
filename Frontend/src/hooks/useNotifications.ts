"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import {
  listPlatformNotifications,
  markPlatformNotificationRead,
  markPlatformNotificationsRead,
  readPlatformNotificationsSnapshot,
  subscribePlatformNotifications,
} from "@/lib/platform-notifications-store";
import { resolveNotificationActionUrl } from "@/lib/platform-notification-routes";
import type {
  NotificationAudience,
  PlatformNotification,
} from "@/types/platform-notification";

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

  const markRead = useCallback((id: string) => {
    markPlatformNotificationRead(id);
  }, []);

  const markAllRead = useCallback(() => {
    markPlatformNotificationsRead(audience);
  }, [audience]);

  const openNotification = useCallback(
    (item: PlatformNotification) => {
      markPlatformNotificationRead(item.id);
      const href = resolveNotificationActionUrl(
        item.type,
        item.metadata,
        item.action_url,
        item.audience,
      );
      if (href) router.push(href);
    },
    [router],
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
