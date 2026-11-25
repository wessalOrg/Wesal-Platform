import type { HallApprovalStatus } from "@/constants/hallApprovalStatus";
import type { HallPaymentStatus } from "@/constants/hallPaymentStatus";

export type HallExpiryWarning = {
  cycleEnd: string;
  daysRemaining: number;
};

export type HallOwnerHall = {
  id: string;
  name: string;
  status: HallApprovalStatus;
  paymentStatus: HallPaymentStatus;
  paymentReceiptUploadedAt: string | null;
  daysRemaining: number | null;
  subscriptionExpiresAt: string | null;
  expiryWarning: HallExpiryWarning | null;
  adminLocked: boolean | null;
  systemLocked: boolean | null;
};

export type HallOwnerHallsLoadStatus = "idle" | "loading" | "ready" | "error";