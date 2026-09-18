import type { HallApprovalStatus } from "@/constants/hallApprovalStatus";

export type HallExpiryWarning = {
  cycleEnd: string;
  daysRemaining: number;
};

export type HallOwnerHall = {
  id: string;
  name: string;
  status: HallApprovalStatus;
  expiryWarning: HallExpiryWarning | null;
};

export type HallOwnerHallsLoadStatus = "idle" | "loading" | "ready" | "error";
