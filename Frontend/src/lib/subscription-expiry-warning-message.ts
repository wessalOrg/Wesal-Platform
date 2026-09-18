import { parseDateIso, utcDaysRemaining, utcTodayIso } from "@/lib/booking-date";

export const SUBSCRIPTION_EXPIRY_WARNING_TYPE = "SUBSCRIPTION_EXPIRY_WARNING";

export type SubscriptionExpiryWarningDetails = {
  hallId: string;
  hallName: string;
  cycleEnd: string;
  daysRemaining: number;
  text: string;
  complete: boolean;
};

export type ClassifiedExpiryWarningContent =
  | { kind: "text" }
  | { kind: "subscription_expiry_warning"; details: SubscriptionExpiryWarningDetails };

const EXPIRY_TEXT =
  /Your subscription for ["“]?(.+?)["”]? ends on (\d{4}-\d{2}-\d{2}) \((\d+) days remaining\)/i;

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

function liveDaysRemaining(cycleEnd: string, snapshot: number | null): number {
  const live = utcDaysRemaining(cycleEnd);
  if (live != null) return live;
  return snapshot ?? 0;
}

function asDetails(
  hallId: string,
  hallName: string,
  cycleEnd: string,
  daysRemaining: number,
  text: string,
): SubscriptionExpiryWarningDetails {
  const iso = parseDateIso(cycleEnd) ?? "";
  return {
    hallId: hallId.trim(),
    hallName: hallName.trim(),
    cycleEnd: iso,
    daysRemaining,
    text: text.trim(),
    complete: Boolean(hallName.trim() && iso),
  };
}

function parseJsonWarning(content: string): ClassifiedExpiryWarningContent | null {
  if (!content.startsWith("{")) return null;
  try {
    const data = JSON.parse(content) as Record<string, unknown>;
    const type = String(data.type ?? data.messageType ?? "").trim().toUpperCase();
    if (type !== SUBSCRIPTION_EXPIRY_WARNING_TYPE) return null;
    const cycleEnd = parseDateIso(asText(data.cycleEnd ?? data.endDate ?? data.expirationDate)) ?? "";
    const snapshot = asInt(data.daysRemaining ?? data.daysLeft);
    const text = asText(data.text) || content;
    return {
      kind: "subscription_expiry_warning",
      details: asDetails(
        asText(data.hallId ?? data.HallId),
        asText(data.hallName ?? data.HallName),
        cycleEnd,
        liveDaysRemaining(cycleEnd, snapshot),
        text,
      ),
    };
  } catch {
    return null;
  }
}

export function parseSubscriptionExpiryWarningMessage(
  content: string,
  fallbackHallName = "",
): ClassifiedExpiryWarningContent {
  const text = content.trim();
  if (!text) return { kind: "text" };

  const fromJson = parseJsonWarning(text);
  if (fromJson?.kind === "subscription_expiry_warning") {
    if (!fromJson.details.hallName && fallbackHallName) {
      return {
        kind: "subscription_expiry_warning",
        details: {
          ...fromJson.details,
          hallName: fallbackHallName,
          complete: Boolean(fallbackHallName && fromJson.details.cycleEnd),
        },
      };
    }
    return fromJson;
  }

  const match = text.match(EXPIRY_TEXT);
  if (match) {
    const cycleEnd = match[2] ?? "";
    const snapshot = match[3] ? Number(match[3]) : null;
    return {
      kind: "subscription_expiry_warning",
      details: asDetails(
        "",
        match[1] || fallbackHallName,
        cycleEnd,
        liveDaysRemaining(cycleEnd, snapshot),
        text,
      ),
    };
  }

  return { kind: "text" };
}

export function isSubscriptionExpiryWarningContent(content: string): boolean {
  return parseSubscriptionExpiryWarningMessage(content).kind === "subscription_expiry_warning";
}

export function isActiveExpiryWarning(cycleEnd: string, todayIso = utcTodayIso()): boolean {
  const iso = parseDateIso(cycleEnd);
  if (!iso) return false;
  return iso >= todayIso;
}
