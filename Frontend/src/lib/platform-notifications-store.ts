import { t } from "@/i18n";
import { resolveNotificationActionUrl } from "@/lib/platform-notification-routes";
import type {
  NotificationAudience,
  PlatformNotification,
  PlatformNotificationMetadata,
  PlatformNotificationTone,
  PlatformNotificationType,
} from "@/types/platform-notification";

const STORAGE_KEY = "wesal-platform-notifications";
const WELCOME_SEEN_KEY = "wesal-welcome-seen";
const MAX_ITEMS = 40;

export const PLATFORM_NOTIFICATIONS_CHANGED = "wesal-platform-notifications-changed";
export const PLATFORM_NOTIFICATION_TOAST = "wesal-platform-notification-toast";

export type PushPlatformNotificationInput = {
  type: PlatformNotificationType;
  audience: NotificationAudience;
  titleKey: string;
  bodyKey: string;
  actionLabelKey?: string;
  params?: Record<string, string>;
  action_url?: string;
  metadata?: PlatformNotificationMetadata;
  tone?: PlatformNotificationTone;
  toast?: boolean;
};

function canUseStorage() {
  return typeof window !== "undefined";
}

function notifyChanged() {
  if (!canUseStorage()) return;
  window.dispatchEvent(new Event(PLATFORM_NOTIFICATIONS_CHANGED));
}

function defaultTone(type: PlatformNotificationType): PlatformNotificationTone {
  if (
    type === "booking_accepted" ||
    type === "hall_approved" ||
    type === "booking_submitted" ||
    type === "hall_submitted"
  ) {
    return "success";
  }
  if (type === "booking_rejected" || type === "hall_rejected" || type === "booking_cancelled") {
    return "danger";
  }
  return "info";
}

/**
 * Serialized store contents (or "" when empty / on the server). Stable by string
 * equality, so it is safe as a `useSyncExternalStore` snapshot.
 */
export function readPlatformNotificationsSnapshot(): string {
  if (!canUseStorage()) return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function readRaw(): PlatformNotification[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => mapStored(item))
      .filter((item): item is PlatformNotification => Boolean(item));
  } catch {
    return [];
  }
}

function writeAll(items: PlatformNotification[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
}

function mapStored(value: unknown): PlatformNotification | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<PlatformNotification>;
  const id = String(item.id ?? "").trim();
  const type = item.type;
  if (!id || !type) return null;
  const metadata = (item.metadata ?? {}) as PlatformNotificationMetadata;
  const action_url = resolveNotificationActionUrl(
    type,
    metadata,
    item.action_url,
    item.audience === "owner" || item.audience === "admin" ? item.audience : "seeker",
  );
  const body = String(item.body ?? item.message ?? "");
  return {
    id,
    type,
    audience: item.audience === "owner" || item.audience === "admin" ? item.audience : "seeker",
    title: String(item.title ?? ""),
    body,
    message: body,
    action_url,
    action_label: item.action_label,
    metadata,
    is_read: Boolean(item.is_read),
    created_at: String(item.created_at ?? new Date().toISOString()),
    tone: item.tone === "success" || item.tone === "danger" ? item.tone : "info",
    titleKey: String(item.titleKey ?? ""),
    bodyKey: String(item.bodyKey ?? ""),
    actionLabelKey: item.actionLabelKey,
    params: item.params && typeof item.params === "object" ? item.params : {},
  };
}

export function hydratePlatformNotification(item: PlatformNotification): PlatformNotification {
  const params = item.params ?? {};
  const title = item.titleKey ? t(item.titleKey, params) : item.title;
  const body = item.bodyKey ? t(item.bodyKey, params) : item.body;
  const action_label = item.actionLabelKey ? t(item.actionLabelKey, params) : item.action_label;
  return {
    ...item,
    title,
    body,
    message: body,
    action_label,
    action_url: resolveNotificationActionUrl(
      item.type,
      item.metadata,
      item.action_url,
      item.audience,
    ),
  };
}

export function listPlatformNotifications(
  audience?: NotificationAudience,
): PlatformNotification[] {
  const items = readRaw().map(hydratePlatformNotification);
  if (!audience) return items;
  return items.filter((item) => item.audience === audience);
}

function isRecentDuplicate(
  items: PlatformNotification[],
  next: Pick<PlatformNotification, "type" | "audience" | "metadata">,
): boolean {
  const hallId = next.metadata.hall_id ?? "";
  const bookingId = next.metadata.booking_id ?? "";
  return items.some((item) => {
    if (item.type !== next.type || item.audience !== next.audience) return false;
    if ((item.metadata.hall_id ?? "") !== hallId) return false;
    if ((item.metadata.booking_id ?? "") !== bookingId) return false;
    return Date.now() - Date.parse(item.created_at) < 8000;
  });
}

export function pushPlatformNotification(
  input: PushPlatformNotificationInput,
): PlatformNotification | null {
  const current = readRaw();
  const metadata = input.metadata ?? {};
  if (isRecentDuplicate(current, { type: input.type, audience: input.audience, metadata })) {
    return null;
  }

  const params = input.params ?? {};
  const title = t(input.titleKey, params);
  const body = t(input.bodyKey, params);
  const action_label = input.actionLabelKey ? t(input.actionLabelKey, params) : undefined;
  const item: PlatformNotification = {
    id: `notify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: input.type,
    audience: input.audience,
    title,
    body,
    message: body,
    action_url: resolveNotificationActionUrl(
      input.type,
      metadata,
      input.action_url,
      input.audience,
    ),
    action_label,
    metadata,
    is_read: false,
    created_at: new Date().toISOString(),
    tone: input.tone ?? defaultTone(input.type),
    titleKey: input.titleKey,
    bodyKey: input.bodyKey,
    actionLabelKey: input.actionLabelKey,
    params,
  };

  writeAll([item, ...current]);
  notifyChanged();

  if (input.toast !== false && canUseStorage()) {
    window.dispatchEvent(
      new CustomEvent(PLATFORM_NOTIFICATION_TOAST, { detail: hydratePlatformNotification(item) }),
    );
  }

  return hydratePlatformNotification(item);
}

export function markPlatformNotificationRead(id: string): void {
  const next = readRaw().map((item) => (item.id === id ? { ...item, is_read: true } : item));
  writeAll(next);
  notifyChanged();
}

export function markPlatformNotificationsRead(audience?: NotificationAudience): void {
  const next = readRaw().map((item) =>
    !audience || item.audience === audience ? { ...item, is_read: true } : item,
  );
  writeAll(next);
  notifyChanged();
}

export function hasSeenWelcome(userId: string): boolean {
  if (!canUseStorage() || !userId.trim()) return false;
  try {
    const raw = window.localStorage.getItem(WELCOME_SEEN_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.includes(userId);
  } catch {
    return false;
  }
}

/** Seeker welcome after registration (or first session if register did not fire). */
export function notifySeekerWelcome(userId?: string | null): void {
  const id = userId?.trim() || "";
  if (!id || hasSeenWelcome(id)) return;
  markWelcomeSeen(id);
  pushPlatformNotification({
    type: "welcome",
    audience: "seeker",
    titleKey: "notify.welcome.title",
    bodyKey: "notify.welcome.body",
    tone: "info",
  });
}

export function markWelcomeSeen(userId: string): void {
  if (!canUseStorage() || !userId.trim()) return;
  try {
    const raw = window.localStorage.getItem(WELCOME_SEEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const ids = Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
    if (ids.includes(userId)) return;
    window.localStorage.setItem(WELCOME_SEEN_KEY, JSON.stringify([...ids, userId]));
  } catch {
    /* ignore quota */
  }
}

export function subscribePlatformNotifications(listener: () => void): () => void {
  if (!canUseStorage()) return () => undefined;
  window.addEventListener(PLATFORM_NOTIFICATIONS_CHANGED, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(PLATFORM_NOTIFICATIONS_CHANGED, listener);
    window.removeEventListener("storage", listener);
  };
}
