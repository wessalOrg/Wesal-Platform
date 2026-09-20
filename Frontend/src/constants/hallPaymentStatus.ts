/**
 * UI payment statuses mirroring the backend HallPaymentStatus enum
 * (Unpaid / ReceiptUploaded / Paid). Server remains the source of truth.
 */
export const HALL_PAYMENT_STATUSES = [
  "Unpaid",
  "ReceiptUploaded",
  "Paid",
] as const;

export type HallPaymentStatus = (typeof HALL_PAYMENT_STATUSES)[number];

export function toHallPaymentStatus(value: unknown): HallPaymentStatus | null {
  if (value === 0 || value === "0" || value === "Unpaid") return "Unpaid";
  if (value === 1 || value === "1" || value === "Paid") return "Paid";
  if (value === 2 || value === "2" || value === "ReceiptUploaded") {
    return "ReceiptUploaded";
  }
  return null;
}

type HallPaymentStatusPresentation = {
  labelKey: string;
  /** Visual tone aligned with the dash-badge variants. */
  tone: "wait" | "ok" | "bad" | "unknown";
};

export const HALL_PAYMENT_STATUS_CONFIG: Record<
  HallPaymentStatus,
  HallPaymentStatusPresentation
> = {
  Unpaid: {
    labelKey: "owner.management.halls.payment.unpaid",
    tone: "bad",
  },
  ReceiptUploaded: {
    labelKey: "owner.management.halls.payment.receiptUploaded",
    tone: "wait",
  },
  Paid: {
    labelKey: "owner.management.halls.payment.paid",
    tone: "ok",
  },
};

export function getHallPaymentStatusConfig(
  status: HallPaymentStatus | undefined | null,
): HallPaymentStatusPresentation {
  if (status && status in HALL_PAYMENT_STATUS_CONFIG) {
    return HALL_PAYMENT_STATUS_CONFIG[status];
  }
  return { labelKey: "owner.management.halls.payment.unknown", tone: "unknown" };
}