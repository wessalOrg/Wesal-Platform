import { hallAccessFromUnknown } from "@/lib/hall-access";
import type { HallApprovalStatus } from "@/constants/hallApprovalStatus";
import { parseDateIso, utcDaysRemaining, utcTodayIso } from "@/lib/booking-date";
import { isActiveExpiryWarning } from "@/lib/subscription-expiry-warning-message";
import type { HallExpiryWarning, HallOwnerHall } from "@/types/hall-owner-halls";

/**
 * Assumed owner halls list contract (US-OWNER-05) until OpenAPI lands.
 *
 * GET /api/v1/owner/halls
 * Auth: Bearer (Hall Owner)
 *
 * Success 200:
 *   HallOwnerHallDto[] | { halls?: HallOwnerHallDto[], items?: HallOwnerHallDto[] }
 *
 * HallOwnerHallDto fields (aliases supported):
 *   id | hallId
 *   name | hallName
 *   status | approvalStatus | hallStatus
 *   paymentStatus | isPaid
 *   adminLocked | isAdminLocked
 *   systemLocked | isSystemLocked
 *   subscriptionCycleEnd | daysRemaining | expiryWarningDispatched
 *
 * Backend HallStatus enum (JsonStringEnumConverter):
 *   PendingReview | Approved | Rejected
 * UI maps PendingReview → Pending.
 */
export type HallOwnerHallDto = {
  id?: string | null;
  hallId?: string | null;
  name?: string | null;
  hallName?: string | null;
  status?: string | null;
  approvalStatus?: string | null;
  hallStatus?: string | null;
  subscriptionCycleEnd?: string | null;
  daysRemaining?: number | string | null;
  expiryWarningDispatched?: boolean | string | null;
  paymentStatus?: string | boolean | null;
  isPaid?: boolean | null;
  paid?: boolean | null;
  adminLocked?: boolean | null;
  isAdminLocked?: boolean | null;
  systemLocked?: boolean | null;
  isSystemLocked?: boolean | null;
};

function readId(dto: HallOwnerHallDto): string | null {
  const value = String(dto.id ?? dto.hallId ?? "").trim();
  return value || null;
}

function readName(dto: HallOwnerHallDto): string {
  return String(dto.name ?? dto.hallName ?? "").trim() || "—";
}

function readRawStatus(dto: HallOwnerHallDto): string {
  return String(dto.status ?? dto.approvalStatus ?? dto.hallStatus ?? "").trim();
}

/** Maps backend status strings onto UI Pending | Approved | Rejected. */
export function mapBackendHallStatus(raw: string): HallApprovalStatus | null {
  const normalized = raw.replace(/[\s_-]/g, "").toLowerCase();
  if (
    normalized === "pending" ||
    normalized === "pendingreview" ||
    normalized === "0"
  ) {
    return "Pending";
  }
  if (normalized === "approved" || normalized === "1") {
    return "Approved";
  }
  if (normalized === "rejected" || normalized === "2") {
    return "Rejected";
  }
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

function mapExpiryWarning(dto: HallOwnerHallDto): HallExpiryWarning | null {
  if (!asBool(dto.expiryWarningDispatched)) return null;
  const cycleEnd = parseDateIso(dto.subscriptionCycleEnd);
  if (!cycleEnd || !isActiveExpiryWarning(cycleEnd, utcTodayIso())) return null;
  const remaining = asInt(dto.daysRemaining) ?? utcDaysRemaining(cycleEnd);
  if (remaining == null) return null;
  return { cycleEnd, daysRemaining: remaining };
}

export function mapHallOwnerHallDto(dto: HallOwnerHallDto): HallOwnerHall | null {
  const id = readId(dto);
  if (!id) return null;
  const status = mapBackendHallStatus(readRawStatus(dto));
  if (!status) return null;
  const access = hallAccessFromUnknown(dto);
  return {
    id,
    name: readName(dto),
    status,
    expiryWarning: mapExpiryWarning(dto),
    paymentStatus: access.paymentStatus,
    adminLocked: access.adminLocked,
    systemLocked: access.systemLocked,
  };
}

export function mapHallOwnerHallsResponse(data: unknown): HallOwnerHall[] {
  const list: HallOwnerHallDto[] = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? Array.isArray((data as { halls?: unknown }).halls)
        ? ((data as { halls: HallOwnerHallDto[] }).halls)
        : Array.isArray((data as { items?: unknown }).items)
          ? ((data as { items: HallOwnerHallDto[] }).items)
          : []
      : [];

  const halls: HallOwnerHall[] = [];
  for (const item of list) {
    const mapped = mapHallOwnerHallDto(item);
    if (mapped) halls.push(mapped);
  }
  return halls;
}
