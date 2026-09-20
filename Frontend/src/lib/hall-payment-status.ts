/**
 * Hall payment confirmation (FR-SUB-01). Independent of HallStatus,
 * AdminLocked, and SystemLocked. Do not infer Paid from Approved.
 */
export const PAYMENT_STATUS = {
  Unpaid: "Unpaid",
  Paid: "Paid",
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function firstDefined(...candidates: unknown[]): unknown {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null) return candidate;
  }
  return undefined;
}

function normalizeToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "");
}

/**
 * Maps PaymentStatus aliases only.
 * Missing values default to Unpaid — never derived from HallStatus or lock flags.
 */
export function parsePaymentStatus(value: unknown): PaymentStatus | null {
  if (typeof value === "boolean") return value ? PAYMENT_STATUS.Paid : PAYMENT_STATUS.Unpaid;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value === 1) return PAYMENT_STATUS.Paid;
    if (value === 0) return PAYMENT_STATUS.Unpaid;
    return null;
  }

  const token = normalizeToken(value);
  if (!token) return null;
  if (
    token === "paid" ||
    token === "confirmed" ||
    token === "paymentconfirmed" ||
    token === "complete" ||
    token === "completed" ||
    token === "active"
  ) {
    return PAYMENT_STATUS.Paid;
  }
  if (
    token === "unpaid" ||
    token === "pending" ||
    token === "paymentpending" ||
    token === "pendingpayment" ||
    token === "awaitingpayment" ||
    token === "awaitingconfirmation"
  ) {
    return PAYMENT_STATUS.Unpaid;
  }
  return null;
}

export function readPaymentStatus(source: unknown): PaymentStatus {
  const dto = asRecord(source);
  if (!dto) return PAYMENT_STATUS.Unpaid;

  const explicit = parsePaymentStatus(
    firstDefined(
      dto.paymentStatus,
      dto.PaymentStatus,
      dto.paymentState,
      dto.PaymentState,
    ),
  );
  if (explicit) return explicit;

  const paidFlag = firstDefined(dto.isPaid, dto.IsPaid, dto.paid, dto.Paid);
  const fromFlag = parsePaymentStatus(paidFlag);
  if (fromFlag) return fromFlag;

  return PAYMENT_STATUS.Unpaid;
}

export function isUnpaidPaymentStatus(status: PaymentStatus): boolean {
  return status === PAYMENT_STATUS.Unpaid;
}

export function paymentStatusMessageKey(status: PaymentStatus): string {
  return status === PAYMENT_STATUS.Paid
    ? "owner.payment.badge.paid"
    : "owner.payment.badge.unpaid";
}
