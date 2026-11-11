import { apiOrigin } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/hall-media-url";

/** Format a money amount for offer cards (locale digits, no forced currency symbol). */
export function formatOfferAmount(
  value: number | null | undefined,
  locale: string = "ar-EG-u-nu-latn",
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value);
}

/** Format offer date range for display. */
export function formatOfferDateRange(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  locale: string = "ar-EG-u-nu-latn",
): string {
  const start = formatOfferDate(startsAt, locale);
  const end = formatOfferDate(endsAt, locale);
  if (!start && !end) return "";
  if (!start) return end;
  if (!end) return start;
  return `${start} – ${end}`;
}

export function formatOfferDate(
  value: string | null | undefined,
  locale: string = "ar-EG-u-nu-latn",
): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/**
 * Resolve offer / discover media URLs.
 * Backend may return `/uploads/...` or `/api/v1/offers/.../images/...`.
 */
export function resolveOfferMediaUrl(url: string | null | undefined): string {
  const value = url?.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("blob:")) {
    return resolveMediaUrl(value);
  }
  if (value.startsWith("/api/") || value.startsWith("/uploads/")) {
    return `${apiOrigin()}${value}`;
  }
  return resolveMediaUrl(value);
}

/** ISO datetime for API from `YYYY-MM-DD` (+ optional time). */
export function offerDateToIso(
  dateValue: string,
  endOfDay = false,
): string {
  const trimmed = dateValue.trim();
  if (!trimmed) return "";
  if (trimmed.includes("T")) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }
  const [y, m, d] = trimmed.split("-").map(Number);
  if (!y || !m || !d) return "";
  const date = endOfDay
    ? new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
    : new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  return date.toISOString();
}

/** Extract `YYYY-MM-DD` for date inputs from an ISO string. */
export function isoToOfferDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
