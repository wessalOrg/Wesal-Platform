import { ApiError } from "@/lib/api-error";
import { parseDateIso, utcDaysRemaining } from "@/lib/booking-date";
import type {
  HallSubscription,
  HallSubscriptionBilling,
  HallSubscriptionLoadStatus,
  HallSubscriptionStatus,
} from "@/types/hall-subscription";

export type HallSubscriptionErrorKind = Exclude<
  HallSubscriptionLoadStatus,
  "idle" | "loading" | "ready"
>;

export class HallSubscriptionError extends ApiError {
  kind: HallSubscriptionErrorKind;

  constructor(message: string, status?: number, kind: HallSubscriptionErrorKind = "error") {
    super(message, status);
    this.name = "HallSubscriptionError";
    this.kind = kind;
  }
}

export function hallSubscriptionErrorKind(err: unknown): HallSubscriptionErrorKind {
  const status = err instanceof ApiError ? err.status : undefined;
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  return "error";
}

export function hallSubscriptionErrorMessageKey(kind: HallSubscriptionErrorKind): string {
  if (kind === "unauthorized") return "errors.owner.subscription.unauthorized";
  if (kind === "forbidden") return "errors.owner.subscription.forbidden";
  if (kind === "not_found") return "errors.owner.subscription.notFound";
  return "errors.owner.subscription.load";
}

export function toHallSubscriptionError(err: unknown): HallSubscriptionError {
  if (err instanceof HallSubscriptionError) return err;
  const kind = hallSubscriptionErrorKind(err);
  const status = err instanceof ApiError ? err.status : undefined;
  return new HallSubscriptionError(hallSubscriptionErrorMessageKey(kind), status, kind);
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function unwrapPayload(payload: unknown): Record<string, unknown> {
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
 * Maps Mohammed's status field only. Does not infer Active/Locked from dates or flags.
 */
export function parseHallSubscriptionStatus(value: unknown): HallSubscriptionStatus | null {
  const token = normalizeToken(value);
  if (!token) return null;
  if (token === "active" || token === "paid" || token === "current") return "active";
  if (
    token === "unpaid" ||
    token === "pending" ||
    token === "paymentpending" ||
    token === "pendingpayment" ||
    token === "awaitingpayment"
  ) {
    return "unpaid";
  }
  if (token === "expired" || token === "lapse" || token === "lapsed") return "expired";
  if (token === "locked" || token === "lock" || token === "suspended") return "locked";
  return null;
}

function firstDate(values: unknown[]): string | null {
  for (const value of values) {
    const text = asText(value);
    if (!text) continue;
    const iso = parseDateIso(text);
    if (iso) return iso;
  }
  return null;
}

function billingFromDto(data: Record<string, unknown>): HallSubscriptionBilling | null {
  const next = firstDate([
    data.nextBillingDate,
    data.nextPaymentDate,
    data.nextBillingAt,
    data.renewsAt,
  ]);
  if (next) return { kind: "next", iso: next };

  const expiration = firstDate([
    data.expirationDate,
    data.expiresAt,
    data.expiryDate,
    data.validUntil,
  ]);
  if (expiration) return { kind: "expiration", iso: expiration };

  const generic = firstDate([data.billingDate, data.currentPeriodEnd, data.periodEnd]);
  if (generic) return { kind: "generic", iso: generic };

  return null;
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const token = String(value ?? "").trim().toLowerCase();
  return token === "true" || token === "1";
}

function asInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

export function mapHallSubscription(payload: unknown, hallId: string): HallSubscription {
  const data = unwrapPayload(payload);
  const status = parseHallSubscriptionStatus(
    data.status ?? data.subscriptionStatus ?? data.statusName ?? data.statusLabel,
  );
  if (!status) {
    throw new HallSubscriptionError("errors.owner.subscription.load", undefined, "error");
  }

  const billing = billingFromDto(data);
  const cycleEnd = billing?.iso ?? firstDate([data.subscriptionCycleEnd]);
  const remaining = asInt(data.daysRemaining) ?? (cycleEnd ? utcDaysRemaining(cycleEnd) : null);

  return {
    hallId: asText(data.hallId) || asText(data.id) || hallId.trim(),
    status,
    billing,
    daysRemaining: remaining,
    expiryWarningDispatched: asBool(data.expiryWarningDispatched),
  };
}

export function subscriptionStatusMessageKey(status: HallSubscriptionStatus): string {
  if (status === "active") return "owner.subscription.active";
  if (status === "unpaid") return "owner.subscription.unpaid";
  if (status === "expired") return "owner.subscription.expired";
  return "owner.subscription.locked";
}

export function subscriptionBillingMessageKey(
  kind: HallSubscriptionBilling["kind"],
): string {
  if (kind === "next") return "owner.subscription.nextBilling";
  if (kind === "expiration") return "owner.subscription.expires";
  return "owner.subscription.billingDate";
}
