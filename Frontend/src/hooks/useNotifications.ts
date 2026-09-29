"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import {
  listPlatformNotifications,
  markPlatformNotificationRead,
  markPlatformNotificationsRead,
  subscribePlatformNotifications,
  unreadPlatformNotificationCount,
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
  const [items, setItems] = useState<PlatformNotification[]>([]);

  const refresh = useCallback(() => {
    setItems(listPlatformNotifications(audience));
  }, [audience]);

  useEffect(() => {
    refresh();
    return subscribePlatformNotifications(refresh);
  }, [refresh]);

  const unreadCount = useMemo(
    () => unreadPlatformNotificationCount(audience),
    [audience, items],
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
