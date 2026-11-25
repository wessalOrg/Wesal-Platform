"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import { useRequestScope } from "@/hooks/useRequestScope";
import {
  isCurrentNotificationAccount,
  readNotificationAccount,
  serverNotificationAccount,
  subscribeNotificationAccount,
} from "@/lib/notification-account";
import { currentNotificationRequests, retainNotificationRequests, readNotificationRequests,
  subscribeNotificationRequests, serverNotificationRequests, orderNotifications } from "@/lib/notification-requests";
import { platformNotificationDedupeKey } from "@/lib/platform-notification-mapper";
import { canReceiveEventRequestNotification } from "@/lib/event-request-notification";
import {
  isServerNotificationId,
  listPlatformNotifications,
  markPlatformNotificationRead,
  markPlatformNotificationsRead,
  readPlatformNotificationsSnapshot,
  subscribePlatformNotifications,
} from "@/lib/platform-notifications-store";
import { resolveNotificationActionUrl } from "@/lib/platform-notification-routes";
import { notificationsUseMock } from "@/services/notifications";
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
  const scope = useRequestScope();
  const account = useSyncExternalStore(
    subscribeNotificationAccount, readNotificationAccount, serverNotificationAccount,
  );
  const audience = audienceOverride ?? audienceFromIdentity(identity);
  // Subscribe to the localStorage-backed store; the serialized snapshot changes
  // whenever notifications are pushed / marked read (same tab or another tab).
  const readSnapshot = useCallback(() => readPlatformNotificationsSnapshot(account), [account]);
  const snapshot = useSyncExternalStore(
    subscribePlatformNotifications,
    readSnapshot,
    () => "",
  );
  const readRequests = useCallback(() => readNotificationRequests(account), [account]);
  const request = useSyncExternalStore(subscribeNotificationRequests, readRequests, serverNotificationRequests);

  const items = useMemo(() => {
    const local = snapshot ? listPlatformNotifications(audience, account) : [];
    const allowed = (item: PlatformNotification) => canReceiveEventRequestNotification(item.type, identity.role);
    if (!request.page) return local.filter(allowed);
    const server = request.items.filter(item => item.audience === audience && allowed(item));
    const keys = new Set(server.map(platformNotificationDedupeKey));
    return orderNotifications([...server, ...local.filter(item => allowed(item) && item.id.startsWith("notify-") &&
      !keys.has(platformNotificationDedupeKey(item)))]);
  }, [account, audience, identity.role, request, snapshot]);

  const localUnreadCount = useMemo(
    () => items.filter((item) => !item.is_read).length,
    [items],
  );
  const serverUnreadCount = request.unreadCount;
  const unreadCount =
    serverUnreadCount != null && serverUnreadCount >= 0
      ? serverUnreadCount
      : localUnreadCount;

  useEffect(() => {
    if (!account || account.token.startsWith("stub-") || notificationsUseMock()) return;
    const { entry, release } = retainNotificationRequests(account);
    void entry.refreshList().then(async () => {
      if (entry.current()) await entry.refreshUnread();
    });
    return release;
  }, [account]);

  const markRead = useCallback((id: string) => {
    if (!scope.isActive() || !isCurrentNotificationAccount(account)) return;
    const item = items.find((item) => item.id === id);
    if (!item || item.is_read) return;
    markPlatformNotificationRead(id, account);
    const entry = currentNotificationRequests(account);
    if (isServerNotificationId(id) && entry) {
      void entry.markRead(id).catch(() => undefined);
    }
  }, [account, items, scope]);

  const markAllRead = useCallback(() => {
    if (!scope.isActive() || !isCurrentNotificationAccount(account)) return;
    markPlatformNotificationsRead(audience, account);
    const entry = currentNotificationRequests(account);
    if (entry) {
      void entry.markRead().catch(() => undefined);
    }
  }, [account, audience, scope]);

  const openNotification = useCallback(
    (item: PlatformNotification) => {
      if (!scope.isActive() || !isCurrentNotificationAccount(account) ||
        !items.some((current) => current.id === item.id)) return;
      markRead(item.id);
      const href = resolveNotificationActionUrl(
        item.type,
        item.metadata,
        item.action_url,
        item.audience,
      );
      if (href) router.push(href);
    },
    [account, items, markRead, router, scope],
  );

  const loadMore = useCallback(() => {
    if (scope.isActive() && isCurrentNotificationAccount(account)) void currentNotificationRequests(account)?.loadMore();
  }, [account, scope]);
  const retry = useCallback(() => {
    if (scope.isActive() && isCurrentNotificationAccount(account)) void currentNotificationRequests(account)?.retry();
  }, [account, scope]);

  return {
    account,
    audience,
    items,
    unreadCount,
    hasUnread: unreadCount > 0,
    markRead,
    markAllRead,
    openNotification,
    totalCount: request.totalCount,
    hasMore: request.hasMore,
    loading: Boolean(account && !account.token.startsWith("stub-") && (!request.page && !request.error || request.loading)),
    error: request.error,
    loadMore,
    retry,
  };
}
