/**
 * Independent hall access dimensions:
 *   HallStatus, PaymentStatus (FR-SUB-01), AdminLocked (FR-SUB-05), SystemLocked (FR-SUB-03).
 * Do not collapse these into a single `locked` property.
 */
import type { HallApprovalStatus } from "@/constants/hallApprovalStatus";
import { parseHallStatus } from "@/lib/hall-status";
import {
  PAYMENT_STATUS,
  readPaymentStatus,
  type PaymentStatus,
} from "@/lib/hall-payment-status";

export type HallAccessState = {
  hallStatus: HallApprovalStatus | null;
  paymentStatus: PaymentStatus;
  adminLocked: boolean;
  systemLocked: boolean;
};

export const UNLOCKED_HALL_ACCESS: HallAccessState = {
  hallStatus: null,
  paymentStatus: PAYMENT_STATUS.Paid,
  adminLocked: false,
  systemLocked: false,
};

export type BookingDataLockReason = "admin" | "system" | "both";

export type ManagementAccessReason =
  | "PAYMENT_REQUIRED"
  | "ADMIN_LOCKED"
  | "SYSTEM_LOCKED"
  | "ADMIN_AND_SYSTEM_LOCKED";

export type ManagementAccessResult =
  | { allowed: true }
  | { allowed: false; reason: ManagementAccessReason };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseBooleanFlag(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  if (typeof value === "string") {
    const token = value.trim().toLowerCase();
    if (token === "true" || token === "1" || token === "yes") return true;
    if (token === "false" || token === "0" || token === "no" || token === "") return false;
  }
  return fallback;
}

function firstDefined(...candidates: unknown[]): unknown {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null) return candidate;
  }
  return undefined;
}

function toOwnerHallStatus(raw: unknown): HallApprovalStatus | null {
  const parsed = parseHallStatus(raw);
  if (parsed === "Approved") return "Approved";
  if (parsed === "Rejected") return "Rejected";
  if (parsed === "PendingReview") return "Pending";
  return null;
}

/** Maps AdminLocked aliases. Missing values default to false — never inferred from SystemLocked. */
export function readAdminLocked(source: unknown): boolean {
  const dto = asRecord(source);
  if (!dto) return false;
  return parseBooleanFlag(
    firstDefined(dto.adminLocked, dto.AdminLocked, dto.isAdminLocked, dto.IsAdminLocked),
    false,
  );
}

/** Maps SystemLocked aliases. Missing values default to false — never inferred from AdminLocked or payment. */
export function readSystemLocked(source: unknown): boolean {
  const dto = asRecord(source);
  if (!dto) return false;
  return parseBooleanFlag(
    firstDefined(dto.systemLocked, dto.SystemLocked, dto.isSystemLocked, dto.IsSystemLocked),
    false,
  );
}

export function readHallApprovalStatus(source: unknown): HallApprovalStatus | null {
  const dto = asRecord(source);
  if (!dto) return null;
  return toOwnerHallStatus(
    firstDefined(
      dto.status,
      dto.Status,
      dto.hallStatus,
      dto.HallStatus,
      dto.approvalStatus,
      dto.ApprovalStatus,
    ),
  );
}

export function hallAccessFromUnknown(source: unknown): HallAccessState {
  return {
    hallStatus: readHallApprovalStatus(source),
    paymentStatus: readPaymentStatus(source),
    adminLocked: readAdminLocked(source),
    systemLocked: readSystemLocked(source),
  };
}

export function hallAccessFromFlags(
  adminLocked: boolean,
  systemLocked: boolean,
  extras?: {
    paymentStatus?: PaymentStatus;
    hallStatus?: HallApprovalStatus | null;
  },
): HallAccessState {
  return {
    hallStatus: extras?.hallStatus ?? null,
    paymentStatus: extras?.paymentStatus ?? PAYMENT_STATUS.Paid,
    adminLocked,
    systemLocked,
  };
}

export function hallAccessFromHall(hall: {
  status: HallApprovalStatus;
  paymentStatus: PaymentStatus;
  adminLocked: boolean;
  systemLocked: boolean;
}): HallAccessState {
  return {
    hallStatus: hall.status,
    paymentStatus: hall.paymentStatus,
    adminLocked: hall.adminLocked,
    systemLocked: hall.systemLocked,
  };
}

/** A hall is locked if any authoritative snapshot reports that flag. Unpaid wins over Paid. */
export function mergeHallAccess(
  ...states: Array<HallAccessState | null | undefined>
): HallAccessState {
  const present = states.filter((state): state is HallAccessState => Boolean(state));
  return {
    hallStatus: present.find((state) => state.hallStatus)?.hallStatus ?? null,
    paymentStatus: present.some((state) => state.paymentStatus === PAYMENT_STATUS.Unpaid)
      ? PAYMENT_STATUS.Unpaid
      : PAYMENT_STATUS.Paid,
    adminLocked: present.some((state) => state.adminLocked),
    systemLocked: present.some((state) => state.systemLocked),
  };
}

/**
 * UI precedence when multiple blocks apply (SRS/backend do not define a table):
 *   1. SystemLocked → SYSTEM_LOCKED (cycle ended; not Payment Pending, not Admin-only)
 *   2. AdminLocked + SystemLocked → combined copy (both flags stay set)
 *   3. Approved + Unpaid → PAYMENT_REQUIRED
 *   4. AdminLocked
 */
export function getManagementAccess(access: HallAccessState): ManagementAccessResult {
  if (access.adminLocked && access.systemLocked) {
    return { allowed: false, reason: "ADMIN_AND_SYSTEM_LOCKED" };
  }
  if (access.systemLocked) {
    return { allowed: false, reason: "SYSTEM_LOCKED" };
  }
  if (access.hallStatus === "Approved" && access.paymentStatus === PAYMENT_STATUS.Unpaid) {
    return { allowed: false, reason: "PAYMENT_REQUIRED" };
  }
  if (access.adminLocked) {
    return { allowed: false, reason: "ADMIN_LOCKED" };
  }
  return { allowed: true };
}

export function canAccessBookingData(access: HallAccessState): boolean {
  return getManagementAccess(access).allowed;
}

export function canAccessCalendar(access: HallAccessState): boolean {
  return canAccessBookingData(access);
}

export function canAccessMessaging(access: HallAccessState): boolean {
  return canAccessBookingData(access);
}

export function canAccessDashboard(access: HallAccessState): boolean {
  return getManagementAccess(access).allowed;
}

export function bookingDataLockReason(access: HallAccessState): BookingDataLockReason | null {
  const result = getManagementAccess(access);
  if (result.allowed) return null;
  if (result.reason === "PAYMENT_REQUIRED") return null;
  if (result.reason === "ADMIN_AND_SYSTEM_LOCKED") return "both";
  if (result.reason === "ADMIN_LOCKED") return "admin";
  return "system";
}

export function hallLockedMessageKey(reason: BookingDataLockReason): string {
  if (reason === "admin") return "owner.hallAccess.locked.admin";
  if (reason === "system") return "owner.hallAccess.locked.system";
  return "owner.hallAccess.locked.both";
}

export function managementLockReason(
  result: ManagementAccessResult,
): BookingDataLockReason | null {
  if (result.allowed) return null;
  if (result.reason === "PAYMENT_REQUIRED") return null;
  if (result.reason === "ADMIN_AND_SYSTEM_LOCKED") return "both";
  if (result.reason === "ADMIN_LOCKED") return "admin";
  return "system";
}
