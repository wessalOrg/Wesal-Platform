function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function utcTodayIso(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
}

/** Calendar-grid today. Local date parts, so the visible month does not shift across UTC midnight. */
export function localTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function utcDaysRemaining(cycleEndIso: string, todayIso = utcTodayIso()): number | null {
  const end = parseDateIso(cycleEndIso);
  const today = parseDateIso(todayIso);
  if (!end || !today) return null;
  const [endY, endM, endD] = end.split("-").map(Number);
  const [todayY, todayM, todayD] = today.split("-").map(Number);
  const endUtc = Date.UTC(endY, endM - 1, endD);
  const todayUtc = Date.UTC(todayY, todayM - 1, todayD);
  return Math.round((endUtc - todayUtc) / 86_400_000);
}

export function addUtcDays(iso: string, amount: number): string {
  const parsed = parseDateIso(iso);
  if (!parsed) return iso;
  const [year, month, day] = parsed.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + amount));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

export function parseDateIso(value?: string | null): string | null {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

/** Backend rejects today and earlier (UTC). */
export function isFutureBookingDate(iso: string): boolean {
  const parsed = parseDateIso(iso);
  if (!parsed) return false;
  return parsed > utcTodayIso();
}

export function formatBookingDateLabel(iso: string, locale: string): string {
  const parsed = parseDateIso(iso);
  if (!parsed) return iso;
  const [year, month, day] = parsed.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

/** Selected-day heading. Date parts stay local so the label matches the clicked cell. */
export function formatBookingDateLong(iso: string, locale: string): string {
  const parsed = parseDateIso(iso);
  if (!parsed) return iso;
  const [year, month, day] = parsed.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
