import type { ConversationSummary } from "@/types/messages";
import { isOwnerAdminConversation } from "@/lib/owner-admin-conversation";

/**
 * True for the professional ↔ Wesal admin account thread.
 * Recognize reserved platform identities and explicit kinds; use hall-less admin
 * naming only for older payloads without a kind. This classifies UI rows only.
 */
export function isAdminAccountConversation(item: ConversationSummary | null | undefined): boolean {
  if (!item) return false;
  if (item.kind === "AdminAccount") return true;
  // Hall-scoped owner↔admin threads are not AdminAccount; ignore those here.
  if ((item.hallId ?? "").trim()) return false;
  // Legacy customer-list payloads can mislabel the platform's own thread.
  // Generic customer names such as "Admin" must still respect CustomerProvider.
  const platformName = /^(?:فريق وصال|إدارة وصال|ادارة وصال|Wesal Team|Wesal Admin)(?:\s*[-–—]\s*(?:الإدارة|ادارة|Admin))?$/i;
  if (/^(admin|system)$/i.test(item.otherParticipantId?.trim() ?? "") ||
      platformName.test(item.otherParticipantName?.trim() ?? "")) return true;
  if (item.kind === "CustomerProvider") return false;
  return isOwnerAdminConversation(item);
}
