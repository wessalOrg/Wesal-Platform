import { t } from "@/i18n";
import { isBookingRejectionContent } from "@/lib/booking-rejection-message";
import type { ConversationSummary } from "@/types/messages";

export function conversationPreviewTitle(item: Pick<ConversationSummary, "otherParticipantName" | "hallName">): string {
  return item.otherParticipantName.trim() || item.hallName.trim() || t("common.hall");
}

export function conversationPreviewSubtitle(
  item: Pick<ConversationSummary, "otherParticipantName" | "hallName">,
): string | null {
  const title = conversationPreviewTitle(item);
  const hall = item.hallName.trim();
  if (!hall || hall === title) return null;
  return hall;
}

export function conversationListPreview(preview: string): string {
  const text = preview.trim();
  if (!text) return "";
  if (isBookingRejectionContent(text)) return t("messages.rejection.preview");
  return text;
}
