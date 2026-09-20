import type { HallApprovalStatus } from "@/constants/hallApprovalStatus";
import type { PaymentStatus } from "@/lib/hall-payment-status";

export type HallExpiryWarning = {
  cycleEnd: string;
  daysRemaining: number;
};

export type HallOwnerHall = {
  id: string;
  name: string;
  status: HallApprovalStatus;
  expiryWarning: HallExpiryWarning | null;
  paymentStatus: PaymentStatus;
  adminLocked: boolean;
  systemLocked: boolean;
};

export type HallOwnerHallsLoadStatus = "idle" | "loading" | "ready" | "error";
