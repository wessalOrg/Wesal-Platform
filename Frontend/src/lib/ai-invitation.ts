export const INVITATION_STORAGE_KEY = "wesal_ai_invitation";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How often a passive invitation may appear. US-AI-03 asks for an occasional,
 * non-intrusive nudge, so every limit here errs on the quiet side: the bubble is
 * a reminder, and a reminder that repeats is an interruption.
 */
export const INVITATION_POLICY = {
  /** Dwell time before the first invitation, so it never greets a landing page. */
  firstDelayMs: 20 * 1000,
  /** A blocked moment is retried rather than spent, then withdrawn if it never clears. */
  retryDelayMs: 4 * 1000,
  giveUpMs: 20 * 1000,
  /** How long the bubble waits for an answer before withdrawing itself. */
  autoHideMs: 12 * 1000,
  maxPerVisit: 1,
  maxPerDay: 2,
  minGapMs: 4 * HOUR,
  /** Dismissal is an explicit "not now", so stay quiet noticeably longer. */
  dismissCooldownMs: 3 * DAY,
  /** The user already found the assistant; it no longer needs advertising. */
  engagedCooldownMs: 14 * DAY,
} as const;

/** Ceiling for any stored cooldown, so a clock change can never mute the bubble forever. */
const MAX_QUIET_MS = 30 * DAY;

/**
 * The rotating invitation copy, one short, on-brand line per appearance. Keys are
 * resolved through the i18n catalogs (same key → natural Arabic or English), so the
 * language follows the site automatically. The list is meant to be walked through
 * over time: each appearance advances a cursor and never repeats the previous line,
 * so users periodically meet a fresh message without this ever being aggressive.
 */
export const INVITATION_MESSAGE_KEYS = [
  "assistant.invite.m01",
  "assistant.invite.m02",
  "assistant.invite.m03",
  "assistant.invite.m04",
  "assistant.invite.m05",
  "assistant.invite.m06",
  "assistant.invite.m07",
  "assistant.invite.m08",
  "assistant.invite.m09",
  "assistant.invite.m10",
  "assistant.invite.m11",
  "assistant.invite.m12",
  "assistant.invite.m13",
  "assistant.invite.m14",
  "assistant.invite.m15",
  "assistant.invite.m16",
  "assistant.invite.m17",
  "assistant.invite.m18",
  "assistant.invite.m19",
  "assistant.invite.m20",
] as const;

/**
 * Deterministic, O(1) rotation: the slot is the cumulative count of invitations
 * actually shown (persisted as `messageCursor`), so the next appearance is always a
 * different message than the last and the whole pool is slowly walked through across
 * days — never a random repeat and never a network/back-end call.
 */
export function invitationMessageKey(cursor: number): string {
  const slot = Number.isFinite(cursor) && cursor > 0 ? Math.floor(cursor) : 0;
  return INVITATION_MESSAGE_KEYS[slot % INVITATION_MESSAGE_KEYS.length];
}

export type InvitationRecord = {
  /** Local day key the counter belongs to. */
  day: string;
  shownToday: number;
  lastShownAt: number;
  /** Epoch ms until which invitations stay silent. */
  quietUntil: number;
  /**
   * Cumulative count of invitations really shown, driving the rotating copy across
   * days. Optional so older stored records (before this field) stay valid; absent
   * values are treated as `0` and persist from the next show onward.
   */
  messageCursor?: number;
};

export const FRESH_INVITATION_RECORD: InvitationRecord = {
  day: "",
  shownToday: 0,
  lastShownAt: 0,
  quietUntil: 0,
  messageCursor: 0,
};

/**
 * Storage can be unavailable (private mode, disabled cookies, quota). The record
 * then lives in memory only: limits still hold for the visit, and the feature
 * degrades to "slightly more forgiving" instead of breaking.
 */
let memoryRecord: InvitationRecord = FRESH_INVITATION_RECORD;

/** Local, not UTC, so "twice a day" matches the user's own day. */
export function invitationDayKey(now: number): string {
  const date = new Date(now);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isInvitationRecord(value: unknown): value is InvitationRecord {
  if (typeof value !== "object" || value === null) return false;
  const { day, shownToday, lastShownAt, quietUntil } = value as Record<string, unknown>;
  return (
    typeof day === "string" &&
    isCount(shownToday) &&
    isCount(lastShownAt) &&
    isCount(quietUntil)
  );
}

function clearStored(): void {
  try {
    window.localStorage.removeItem(INVITATION_STORAGE_KEY);
  } catch {
    // Nothing to do: the in-memory record is already the source of truth.
  }
}

/** Always returns a usable record; anything unparsable is discarded, never trusted. */
export function readInvitationRecord(): InvitationRecord {
  if (typeof window === "undefined") return FRESH_INVITATION_RECORD;
  try {
    const raw = window.localStorage.getItem(INVITATION_STORAGE_KEY);
    if (!raw) return memoryRecord;

    const parsed: unknown = JSON.parse(raw);
    if (isInvitationRecord(parsed)) return parsed;

    clearStored();
    return FRESH_INVITATION_RECORD;
  } catch {
    // Unparsable text would throw on every future read, so drop it as well.
    clearStored();
    return memoryRecord;
  }
}

function writeInvitationRecord(record: InvitationRecord): void {
  memoryRecord = record;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INVITATION_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Persistence failed; the visit still respects every limit through memory.
  }
}

/**
 * The single gate for showing an invitation. Pure, so the whole policy can be
 * checked without a browser.
 */
export function canShowInvitation(
  record: InvitationRecord,
  shownThisVisit: number,
  now: number,
): boolean {
  if (shownThisVisit >= INVITATION_POLICY.maxPerVisit) return false;

  // A cooldown beyond the ceiling means the stored clock cannot be trusted.
  const quietFor = record.quietUntil - now;
  if (quietFor > 0 && quietFor <= MAX_QUIET_MS) return false;

  if (
    record.day === invitationDayKey(now) &&
    record.shownToday >= INVITATION_POLICY.maxPerDay
  ) {
    return false;
  }

  // A timestamp in the future is a clock change, not a recent invitation.
  const sinceLast = now - record.lastShownAt;
  if (record.lastShownAt > 0 && sinceLast >= 0 && sinceLast < INVITATION_POLICY.minGapMs) {
    return false;
  }

  return true;
}

/** Counted only once the bubble is really on screen, never when it is merely mounted. */
export function recordInvitationShown(now: number): void {
  const record = readInvitationRecord();
  const today = invitationDayKey(now);
  writeInvitationRecord({
    day: today,
    shownToday: record.day === today ? record.shownToday + 1 : 1,
    lastShownAt: now,
    quietUntil: record.quietUntil,
    messageCursor: (record.messageCursor ?? 0) + 1,
  });
}

export function silenceInvitations(now: number, durationMs: number): void {
  const record = readInvitationRecord();
  const until = now + Math.min(durationMs, MAX_QUIET_MS);
  if (until <= record.quietUntil) return;
  writeInvitationRecord({ ...record, quietUntil: until });
}
