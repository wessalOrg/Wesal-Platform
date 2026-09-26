/** Highest exact count shown before collapsing to an overflow label. */
export const UNREAD_BADGE_MAX = 99;

/**
 * Presentation-only formatting for unread badges.
 * Returns null when nothing should be shown.
 */
export function formatUnreadCount(count: number): string | null {
  if (!Number.isFinite(count)) return null;
  const value = Math.floor(count);
  if (value <= 0) return null;
  if (value > UNREAD_BADGE_MAX) return `${UNREAD_BADGE_MAX}+`;
  return String(value);
}

/** Sanitize API/local counts before storing or rendering. */
export function normalizeUnreadCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}
