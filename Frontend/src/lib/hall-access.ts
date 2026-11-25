/**
 * Independent hall access dimensions:
 *   HallStatus, PaymentStatus (FR-SUB-01), AdminLocked (FR-SUB-05), SystemLocked (FR-SUB-03).
 * Do not collapse these into a single `locked` property.
 */
import type { HallApprovalStatus } from "@/constants/hallApprovalStatus";
import type { HallPaymentStatus } from "@/constants/hallPaymentStatus";
import { parseHallStatus } from "@/lib/hall-status";
import {
  PAYMENT_STATUS,
  readPaymentStatus,
  type PaymentStatus,
} from "@/lib/hall-payment-status";

export type HallAccessState = {
  hallStatus: HallApprovalStatus | null;
  paymentStatus: PaymentStatus;
  adminLocked: boolean | null;
  systemLocked: boolean | null;
};

/** Missing flags are not evidence that a hall is unlocked. */
export const UNKNOWN_HALL_ACCESS: HallAccessState = {
  hallStatus: null,
  paymentStatus: PAYMENT_STATUS.Paid,
  adminLocked: null,
  systemLocked: null,
};

export type HallLockStatus = "locked" | "unlocked" | "unknown";

export function getHallLockStatus(access: Pick<HallAccessState, "adminLocked" | "systemLocked">): HallLockStatus {
  if (access.adminLocked === true || access.systemLocked === true) return "locked";
  if (access.adminLocked === false && access.systemLocked === false) return "unlocked";
  return "unknown";
}

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

export function parseBooleanFlag(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  if (typeof value === "string") {
    const token = value.trim().toLowerCase();
    if (token === "true" || token === "1" || token === "yes") return true;
    if (token === "false" || token === "0" || token === "no") return false;
  }
  return null;
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

/** Missing or malformed AdminLocked aliases remain unknown. */
export function readAdminLocked(source: unknown): boolean | null {
  const dto = asRecord(source);
  if (!dto) return null;
  return parseBooleanFlag(
    firstDefined(dto.adminLocked, dto.AdminLocked, dto.isAdminLocked, dto.IsAdminLocked),
  );
}

/** SystemLocked is never inferred from payment, approval, or subscription dates. */
export function readSystemLocked(source: unknown): boolean | null {
  const dto = asRecord(source);
  if (!dto) return null;
  return parseBooleanFlag(
    firstDefined(dto.systemLocked, dto.SystemLocked, dto.isSystemLocked, dto.IsSystemLocked),
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
  adminLocked: boolean | null,
  systemLocked: boolean | null,
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
  paymentStatus: HallPaymentStatus;
  adminLocked: boolean | null;
  systemLocked: boolean | null;
}): HallAccessState {
  return {
    hallStatus: hall.status,
    paymentStatus:
      hall.paymentStatus === "Paid" ? PAYMENT_STATUS.Paid : PAYMENT_STATUS.Unpaid,
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
    adminLocked: mergeLockFlags(present.map((state) => state.adminLocked)),
    systemLocked: mergeLockFlags(present.map((state) => state.systemLocked)),
  };
}

function mergeLockFlags(flags: Array<boolean | null>): boolean | null {
  if (flags.includes(true)) return true;
  return flags.includes(false) ? false : null;
}

/**
 * UI precedence when multiple blocks apply (SRS/backend do not define a table):
 *   1. Explicit SystemLocked → SYSTEM_LOCKED (independent of subscription dates)
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
  // Unknown flags do not assert an unlocked hall or introduce a new restriction.
  // The backend remains authoritative for operational permissions.
  return { allowed: true };
}

export function canAccessBookingData(access: HallAccessState): boolean {
  return getManagementAccess(access).allowed;
}

export function canAccessCalendar(access: HallAccessState): boolean {
  return canAccessBookingData(access);
}

export function canAccessMessaging(access: HallAccessState): boolean {
  const result = getManagementAccess(access);
  if (result.allowed) return true;
  // Owner must still reach the Admin thread while payment is pending.
  return result.reason === "PAYMENT_REQUIRED";
}

export function canAccessDashboard(access: HallAccessState): boolean {
  return getManagementAccess(access).allowed;
}

/** Public seeker actions (book / contact) are blocked by Admin or System lock only. */
export function isHallPubliclyUnavailable(access: HallAccessState): boolean {
  return access.adminLocked === true || access.systemLocked === true;
}

export function hallLockedMessageKey(reason: BookingDataLockReason): string {
  if (reason === "admin") return "owner.hallAccess.locked.admin";
  if (reason === "system") return "owner.hallAccess.locked.system";
  return "owner.hallAccess.locked.both";
}
