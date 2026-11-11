import type { ConversationSummary } from "@/types/messages";
import { isOwnerAdminConversation } from "@/lib/owner-admin-conversation";

/** True for the professional ↔ Wesal admin account thread (not hall-owner admin). */
export function isAdminAccountConversation(item: ConversationSummary | null | undefined): boolean {
  if (!item) return false;
  if (item.kind === "AdminAccount") return true;
  return isOwnerAdminConversation(item);
}
