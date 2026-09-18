export type HallSubscriptionStatus = "active" | "unpaid" | "expired" | "locked";

export type HallSubscriptionBillingKind = "next" | "expiration" | "generic";

export type HallSubscriptionBilling = {
  kind: HallSubscriptionBillingKind;
  iso: string;
};

export type HallSubscription = {
  hallId: string;
  status: HallSubscriptionStatus;
  billing: HallSubscriptionBilling | null;
  daysRemaining: number | null;
  expiryWarningDispatched: boolean;
};

export type HallSubscriptionLoadStatus =
  | "idle"
  | "loading"
  | "ready"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "error";
