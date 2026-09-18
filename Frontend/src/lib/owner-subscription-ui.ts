import type { HallSubscriptionStatus } from "@/types/hall-subscription";

export type SubscriptionVisualTone = HallSubscriptionStatus | "loading" | "error";

export function subscriptionCardToneClass(tone: SubscriptionVisualTone): string {
  if (tone === "active") return "hall-sub-tone-active";
  if (tone === "unpaid") return "hall-sub-tone-unpaid";
  if (tone === "expired") return "hall-sub-tone-expired";
  if (tone === "locked") return "hall-sub-tone-locked";
  if (tone === "error") return "hall-sub-tone-error";
  return "hall-sub-tone-loading";
}

export function subscriptionStatusHintKey(status: HallSubscriptionStatus): string {
  if (status === "active") return "owner.subscription.activeHint";
  if (status === "unpaid") return "owner.subscription.unpaidHint";
  if (status === "expired") return "owner.subscription.expiredHint";
  return "owner.subscription.lockedHint";
}

export function expiryDaysRemainingMessageKey(daysRemaining: number): string {
  if (daysRemaining <= 0) return "owner.subscription.expiryWarning.daysRemainingZero";
  if (daysRemaining === 1) return "owner.subscription.expiryWarning.daysRemainingOne";
  return "owner.subscription.expiryWarning.daysRemaining";
}
