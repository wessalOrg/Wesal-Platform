import { formatBookingDateLabel, parseDateIso } from "@/lib/booking-date";
import { parseBookingPeriodType } from "@/lib/booking-period";
import { t } from "@/i18n";
import type { BookingPeriodType } from "@/types/booking";
import type {
  OwnerAvailabilityDay,
  OwnerAvailabilityPeriod,
  OwnerAvailabilityPeriodUpdate,
  OwnerPeriodAvailabilityStatus,
} from "@/types/owner-availability";

export function ownerAvailabilityPeriodKey(dateIso: string, periodType: BookingPeriodType): string {
  return `${dateIso}::${periodType}`;
}

export function currentUtcMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function shiftUtcMonth(month: string, amount: number): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthIndex - 1 + amount, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthDateRange(month: string): { from: string; to: string } {
  const [year, monthIndex] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, "0")}`,
  };
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function unwrapList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const nested = root.data;
  if (Array.isArray(nested)) return nested;
  if (nested && typeof nested === "object") {
    const inner = nested as Record<string, unknown>;
    if (Array.isArray(inner.days)) return inner.days;
    if (Array.isArray(inner.availability)) return inner.availability;
    if (Array.isArray(inner.items)) return inner.items;
  }
  if (Array.isArray(root.days)) return root.days;
  if (Array.isArray(root.availability)) return root.availability;
  if (Array.isArray(root.items)) return root.items;
  return [];
}

function unwrapObject(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const root = payload as Record<string, unknown>;
  const nested = root.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return root;
}

function normalizeToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "");
}

/**
 * Maps Abdulaziz's period status field only. Does not infer booked/blocked from dates.
 */
export function parseOwnerPeriodStatus(value: unknown): OwnerPeriodAvailabilityStatus | null {
  if (value === 0 || value === "0") return "available";
  if (value === 1 || value === "1") return "booked";
  if (value === 2 || value === "2") return "unavailable";
  const token = normalizeToken(value);
  if (!token) return null;
  if (token === "available" || token === "open" || token === "free") return "available";
  if (token === "booked" || token === "reserved") return "booked";
  if (
    token === "unavailable" ||
    token === "blocked" ||
    token === "closed" ||
    token === "off" ||
    token === "disabled"
  ) {
    return "unavailable";
  }
  return null;
}

export function nextOwnerPeriodToggle(
  status: OwnerPeriodAvailabilityStatus,
): OwnerPeriodAvailabilityStatus {
  if (status === "available") return "booked";
  return "available";
}

/** wesal-api AvailabilityStatus is Available | Booked only. */
export function toOwnerAvailabilityApiStatus(
  status: OwnerPeriodAvailabilityStatus,
): "Available" | "Booked" {
  return status === "available" ? "Available" : "Booked";
}

function formatTimeRange(start?: unknown, end?: unknown): string | undefined {
  const from = asText(start);
  const to = asText(end);
  if (!from || !to) return undefined;
  return `${from.slice(0, 5)} – ${to.slice(0, 5)}`;
}

function periodLabel(periodType: BookingPeriodType, name?: string): string {
  if (periodType === "FirstPeriod") return t("halls.period.first");
  if (periodType === "SecondPeriod") return t("halls.period.second");
  return name?.trim() || t("halls.period.generic");
}

function mapPeriod(raw: unknown): OwnerAvailabilityPeriod | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const periodType = parseBookingPeriodType(
    (data.periodType ?? data.period ?? data.type) as string | number | undefined,
  );
  const status = parseOwnerPeriodStatus(data.status ?? data.availabilityStatus);
  if (!periodType || !status) return null;
  return {
    periodType,
    label: periodLabel(periodType, asText(data.periodName) || asText(data.name) || asText(data.label)),
    time: formatTimeRange(data.startTime, data.endTime),
    status,
  };
}

export function mapOwnerAvailabilityDays(payload: unknown, locale: string): OwnerAvailabilityDay[] {
  const rows = unwrapList(payload);
  const days: OwnerAvailabilityDay[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const data = row as Record<string, unknown>;
    const dateIso = parseDateIso(asText(data.date) || asText(data.dateIso) || asText(data.day));
    if (!dateIso) continue;
    const sourcePeriods = Array.isArray(data.periods) ? data.periods : [];
    const periods = sourcePeriods
      .map(mapPeriod)
      .filter((item): item is OwnerAvailabilityPeriod => Boolean(item));
    days.push({
      dateIso,
      dateLabel: formatBookingDateLabel(dateIso, locale),
      periods,
    });
  }

  days.sort((left, right) => left.dateIso.localeCompare(right.dateIso));
  return days;
}

export function mapOwnerPeriodUpdate(
  payload: unknown,
  fallback: OwnerAvailabilityPeriodUpdate,
): OwnerAvailabilityPeriodUpdate {
  const data = unwrapObject(payload);
  const dateIso =
    parseDateIso(asText(data.date) || asText(data.dateIso)) || fallback.dateIso;
  const periodType =
    parseBookingPeriodType((data.periodType ?? data.period) as string | number | undefined) ||
    fallback.periodType;
  const status = parseOwnerPeriodStatus(data.status) ?? fallback.status;
  return {
    hallId: asText(data.hallId) || fallback.hallId,
    dateIso,
    periodType,
    status,
    label: periodLabel(periodType, asText(data.periodName) || asText(data.label)) || fallback.label,
    time: formatTimeRange(data.startTime, data.endTime) ?? fallback.time,
  };
}

export function patchOwnerAvailabilityDay(
  days: OwnerAvailabilityDay[],
  update: Pick<OwnerAvailabilityPeriodUpdate, "dateIso" | "periodType" | "status" | "label" | "time">,
): OwnerAvailabilityDay[] {
  let changed = false;
  const next = days.map((day) => {
    if (day.dateIso !== update.dateIso) return day;
    let periodChanged = false;
    const periods = day.periods.map((period) => {
      if (period.periodType !== update.periodType) return period;
      periodChanged = true;
      return {
        ...period,
        status: update.status,
        label: update.label || period.label,
        time: update.time ?? period.time,
      };
    });
    if (!periodChanged) return day;
    changed = true;
    return { ...day, periods };
  });
  return changed ? next : days;
}

export function ownerPeriodStatusMessageKey(status: OwnerPeriodAvailabilityStatus): string {
  if (status === "available") return "owner.availability.available";
  if (status === "unavailable") return "owner.availability.unavailable";
  return "owner.availability.booked";
}
