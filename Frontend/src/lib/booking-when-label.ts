import { bookingPeriodI18nKey } from "@/lib/booking-rejection-message";
import { formatHourlyRange, normalizeTimeOnly } from "@/lib/hourly-slots";

export function formatSlotStartsLabel(slotStarts: string[] | undefined, locale: string): string[] {
  if (!slotStarts?.length) return [];
  return slotStarts
    .map((start) => {
      const normalized = normalizeTimeOnly(start);
      if (!normalized) return "";
      const [hour] = normalized.split(":").map(Number);
      if (!Number.isFinite(hour)) return normalized;
      const end = `${String(hour + 1).padStart(2, "0")}:00`;
      return formatHourlyRange(normalized, end, locale);
    })
    .filter(Boolean);
}

export function bookingWhenLabels(
  item: {
    timeRange?: string | null;
    slotStarts?: string[];
    slotStart?: string;
    periods?: string[];
    period?: string;
  },
  translate: (key: string) => string,
  locale: string,
): string[] {
  const range = item.timeRange?.trim();
  if (range) return [range];
  const starts = item.slotStarts?.length
    ? item.slotStarts
    : item.slotStart
      ? [item.slotStart]
      : [];
  const slots = formatSlotStartsLabel(starts, locale);
  if (slots.length > 0) return slots;
  const periods = item.periods ?? (item.period ? [item.period] : []);
  if (periods.length > 0) {
    return periods.map((period) => {
      const key = bookingPeriodI18nKey(period);
      return key ? translate(key) : period;
    });
  }
  return [];
}
