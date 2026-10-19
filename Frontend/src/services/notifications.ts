import api from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { mapServerNotification } from "@/lib/platform-notification-mapper";
import { resolveNotificationActionUrl } from "@/lib/platform-notification-routes";
import type { PlatformNotification } from "@/types/platform-notification";

/**
 * The durable notifications inbox (`GET /notifications`). Demo/stub login has no server
 * session, so it stays on the local store instead of calling the API.
 */
export function notificationsUseMock(): boolean {
  if (!isDemoModeEnabled()) return false;
  const token = getAccessToken();
  return !token || token.startsWith("stub-");
}

/** Mirrors `UserNotificationDto`; enums are serialized as their C# names. */
type ApiUserNotification = {
  id?: string;
  /** `NotificationKind` name (the DTO exposes it as `type`). */
  type?: string;
  kind?: string;
  title?: string;
  body?: string;
  createdAt?: string;
  isRead?: boolean;
  readAt?: string | null;
  /** `NotificationActionTarget` name. */
  actionTarget?: string | null;
  targetId?: string | null;
};

type ApiPagedUserNotifications = {
  items?: ApiUserNotification[] | null;
};

function mapInboxItem(item: ApiUserNotification): PlatformNotification | null {
  const id = String(item.id ?? "").trim();
  if (!id) return null;

  const mapped = mapServerNotification({
    kind: item.type ?? item.kind,
    title: item.title,
    body: item.body,
    targetId: item.targetId,
    actionTarget: item.actionTarget,
  });
  if (!mapped) return null;

  return {
    id,
    type: mapped.type,
    audience: mapped.audience,
    title: mapped.title,
    body: mapped.body,
    message: mapped.body,
    action_url: resolveNotificationActionUrl(
      mapped.type,
      mapped.metadata,
      mapped.action_url,
      mapped.audience,
    ),
    action_label: mapped.actionLabel,
    metadata: mapped.metadata,
    is_read: Boolean(item.isRead ?? item.readAt),
    created_at: item.createdAt?.trim() || new Date().toISOString(),
    tone: mapped.tone,
    titleKey: "",
    bodyKey: "",
    params: {},
  };
}

/** Loads the authenticated user's durable inbox, newest first. */
export async function fetchServerNotifications(
  pageSize = 40,
): Promise<PlatformNotification[]> {
  const { data } = await api.get<ApiPagedUserNotifications>("/notifications", {
    params: { page: 1, pageSize },
    timeout: 8000,
  });
  const rows = Array.isArray(data?.items) ? data.items : [];
  return rows
    .map(mapInboxItem)
    .filter((item): item is PlatformNotification => Boolean(item));
}

export async function markServerNotificationRead(notificationId: string): Promise<void> {
  await api.put(`/notifications/${notificationId}/read`, undefined, { timeout: 8000 });
}

export async function markAllServerNotificationsRead(): Promise<void> {
  await api.put("/notifications/read-all", undefined, { timeout: 8000 });
}
