import type { UiLang } from "@/lib/language";

export type BookingRejectionDetails = {
  hallName: string;
  date: string;
  period: string;
  reason: string;
  complete: boolean;
  source: "json" | "text" | "partial";
};

export type ClassifiedThreadContent =
  | { kind: "text" }
  | { kind: "booking_rejection"; details: BookingRejectionDetails };

/** Matches BookingRejectionService.BuildRejectionContent on the backend. */
const REJECTION_TEXT =
  /^Your booking request for (.+) on (\d{4}-\d{2}-\d{2}) for the (.+) period was rejected by the hall owner\. Reason:\s*([\s\S]*)$/i;

const REJECTION_HINT = /was rejected by the hall owner/i;

export function formatBookingRejectionContent(
  hallName: string,
  date: string,
  period: string,
  reason: string,
): string {
  return `Your booking request for ${hallName} on ${date} for the ${period} period was rejected by the hall owner. Reason: ${reason}`;
}

function asDetails(
  hallName: string,
  date: string,
  period: string,
  reason: string,
  source: BookingRejectionDetails["source"],
): BookingRejectionDetails {
  const next: BookingRejectionDetails = {
    hallName: hallName.trim(),
    date: date.trim(),
    period: period.trim(),
    reason: reason.trim(),
    complete: false,
    source,
  };
  next.complete = Boolean(next.hallName && next.date && next.period && next.reason);
  return next;
}

function parseJsonRejection(content: string): ClassifiedThreadContent | null {
  if (!content.startsWith("{")) return null;
  try {
    const data = JSON.parse(content) as Record<string, unknown>;
    const type = String(data.type ?? data.messageType ?? "");
    if (type.toUpperCase() !== "BOOKING_REJECTION") return null;
    return {
      kind: "booking_rejection",
      details: asDetails(
        String(data.hallName ?? data.HallName ?? ""),
        String(data.date ?? data.requestedDate ?? ""),
        String(data.period ?? data.bookingPeriod ?? ""),
        String(data.reason ?? data.rejectionReason ?? ""),
        "json",
      ),
    };
  } catch {
    return null;
  }
}

export function parseBookingRejectionMessage(
  content: string,
  fallbackHallName = "",
): ClassifiedThreadContent {
  const text = content.trim();
  if (!text) return { kind: "text" };

  const fromJson = parseJsonRejection(text);
  if (fromJson) {
    if (fromJson.kind === "booking_rejection" && !fromJson.details.hallName && fallbackHallName) {
      return {
        kind: "booking_rejection",
        details: { ...fromJson.details, hallName: fallbackHallName, complete: Boolean(fallbackHallName && fromJson.details.date && fromJson.details.period && fromJson.details.reason) },
      };
    }
    return fromJson;
  }

  const match = text.match(REJECTION_TEXT);
  if (match) {
    return {
      kind: "booking_rejection",
      details: asDetails(match[1] || fallbackHallName, match[2] ?? "", match[3] ?? "", match[4] ?? "", "text"),
    };
  }

  if (REJECTION_HINT.test(text)) {
    return {
      kind: "booking_rejection",
      details: asDetails(fallbackHallName, "", "", "", "partial"),
    };
  }

  return { kind: "text" };
}

export function isBookingRejectionContent(content: string): boolean {
  return parseBookingRejectionMessage(content).kind === "booking_rejection";
}

export function bookingPeriodI18nKey(period: string): string {
  const value = period.toLowerCase().replace(/\s+/g, "");
  if (value === "0" || value.includes("first") || value.includes("morning") || value.includes("أول") || value.includes("صباح")) {
    return "halls.period.first";
  }
  if (value === "1" || value.includes("second") || value.includes("evening") || value.includes("ثان") || value.includes("مساء")) {
    return "halls.period.second";
  }
  return "halls.period.generic";
}

export function formatRejectionDate(isoDate: string, lang: UiLang): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString(lang === "en" ? "en-GB" : "ar-EG-u-nu-latn", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
