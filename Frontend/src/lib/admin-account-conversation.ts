import type { ConversationSummary } from "@/types/messages";
import { isOwnerAdminConversation } from "@/lib/owner-admin-conversation";

/**
 * True for the professional ↔ Wesal admin account thread.
 * Prefer explicit Kind; fall back to hall-less admin naming for older payloads.
 */
export function isAdminAccountConversation(item: ConversationSummary | null | undefined): boolean {
  if (!item) return false;
  if (item.kind === "AdminAccount") return true;
  // Hall-scoped owner↔admin threads are not AdminAccount; ignore those here.
  if ((item.hallId ?? "").trim()) return false;
  return isOwnerAdminConversation(item);
}
