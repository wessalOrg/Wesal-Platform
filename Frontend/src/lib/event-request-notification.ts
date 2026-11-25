import { isEventCoordinatorRole, isHallOwnerRole, isPhotographerRole } from "@/lib/account-role";
import type { PlatformNotificationType } from "@/types/platform-notification";

export const EVENT_REQUEST_NOTIFICATION_KINDS = {
  EVENT_REQUEST_HALL: "event_request_hall",
  EVENT_REQUEST_DECORATION_GIFTS: "event_request_decoration_gifts",
  EVENT_REQUEST_PHOTOGRAPHY: "event_request_photography",
} as const;

export type EventRequestNotificationType = typeof EVENT_REQUEST_NOTIFICATION_KINDS[keyof typeof EVENT_REQUEST_NOTIFICATION_KINDS];
export function isEventRequestNotification(type: string): type is EventRequestNotificationType {
  return Object.values(EVENT_REQUEST_NOTIFICATION_KINDS).some(value => value === type);
}
export function isEventRequestNotificationKind(kind: unknown): boolean {
  return typeof kind === "string" && Object.hasOwn(EVENT_REQUEST_NOTIFICATION_KINDS, kind.trim());
}
export function canReceiveEventRequestNotification(type: PlatformNotificationType, role?: string | null): boolean {
  switch (type) {
    case "event_request_hall": return isHallOwnerRole(role);
    case "event_request_decoration_gifts": return isEventCoordinatorRole(role);
    case "event_request_photography": return isPhotographerRole(role);
    default: return true;
  }
}

/** Both REST ConversationId and realtime TargetId refer to the existing Guid conversation. */
export function eventRequestConversationId(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim()) &&
    value.trim() !== "00000000-0000-0000-0000-000000000000" ? value.trim() : null;
}
