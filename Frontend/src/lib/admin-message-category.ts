import { isSubscriptionExpiryWarningContent } from "@/lib/subscription-expiry-warning-message";
import type { AdminMessageCategory } from "@/types/admin-messages";

/** Backend system sender used for subscription / lock notices. */
export const ADMIN_SYSTEM_SENDER_USER_ID = "system";

/**
 * Ended-cycle lock notice from SubscriptionExpiryLockService
 * (same owner/Admin thread as other payment notices).
 */
const SUBSCRIPTION_ENDED_NOTICE =
  /Your subscription for ["“]?(.+?)["”]? has ended without a confirmed renewal/i;

/**
 * Arabic / English cues already used in product copy for payment reminders.
 * Kept narrow so ordinary chat is not misclassified.
 */
const PAYMENT_NOTICE_CUES =
  /(?:اشتراك القاعة بحاجة إلى الدفع|إشعار دفع|subscription(?:\s+\w+){0,4}\s+payment|renew your subscription|please renew)/i;

/**
 * Classify a message preview into an admin inbox category.
 * Prefers existing domain parsers for system subscription notices;
 * does not invent payment amounts or business state.
 */
export function classifyAdminMessageCategory(
  preview: string,
  senderUserId?: string | null,
): AdminMessageCategory {
  if (
    senderUserId &&
    senderUserId.trim().toLowerCase() === ADMIN_SYSTEM_SENDER_USER_ID
  ) {
    return "payment_notice";
  }

  const text = preview.trim();
  if (!text) return "conversation";

  if (isSubscriptionExpiryWarningContent(text)) return "payment_notice";
  if (SUBSCRIPTION_ENDED_NOTICE.test(text)) return "payment_notice";
  if (PAYMENT_NOTICE_CUES.test(text)) return "payment_notice";

  return "conversation";
}
