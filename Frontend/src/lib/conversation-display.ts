import { t } from "@/i18n";
import { isBookingRejectionContent } from "@/lib/booking-rejection-message";
import { isChatImageUrl, isPaymentReceiptNotice } from "@/lib/chat-image-message";
import { isSubscriptionExpiryWarningContent } from "@/lib/subscription-expiry-warning-message";
import { localizeHallName } from "@/lib/localize-hall-display";
import type { UiLang } from "@/lib/language";
import type { ConversationSummary } from "@/types/messages";

type ConversationPreviewSource = Pick<
  ConversationSummary,
  "otherParticipantName" | "hallName" | "hallId"
>;

export function conversationHallLabel(
  item: Pick<ConversationSummary, "hallId" | "hallName">,
  lang: UiLang,
): string {
  return (
    localizeHallName(item?.hallId ?? "", item?.hallName ?? "", lang).trim() || t("common.hall")
  );
}

export function conversationPreviewTitle(
  item: ConversationPreviewSource,
  lang: UiLang = "ar",
): string {
  const owner = item?.otherParticipantName?.trim() || "";
  if (owner) {
    if (lang !== "en") return owner;
    return owner
      .replace(/^صاحب قاعة\s*/u, "Owner of ")
      .replace(/^صاحب\s+/u, "Owner · ");
  }
  return conversationHallLabel(item, lang);
}

export function conversationPreviewSubtitle(
  item: ConversationPreviewSource,
  lang: UiLang = "ar",
): string | null {
  const title = conversationPreviewTitle(item, lang);
  const hall = conversationHallLabel(item, lang);
  if (!hall || hall === title) return null;
  return hall;
}

export function conversationAvatarInitials(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "?";
}

export function conversationPeerRoleLabel(options: {
  viewerIsHallOwner: boolean;
  viewerIsAdmin: boolean;
  peerIsAdmin?: boolean;
}): string {
  if (options.peerIsAdmin) return t("messages.role.admin");
  if (options.viewerIsAdmin) return t("messages.role.owner");
  if (options.viewerIsHallOwner) return t("messages.role.user");
  return t("messages.role.owner");
}

export function conversationListPreview(
  preview: string,
  hasAttachment = false,
): string {
  const text = (preview ?? "").trim();
  if (hasAttachment && !text) return t("messages.imagePreview");
  if (!text) return "";
  if (isBookingRejectionContent(text)) return t("messages.rejection.preview");
  if (isSubscriptionExpiryWarningContent(text)) return t("messages.subscriptionExpiry.preview");
  if (isPaymentReceiptNotice(text)) return t("messages.receiptNotice.preview");
  if (isChatImageUrl(text) || hasAttachment) return t("messages.imagePreview");
  if (text.startsWith("{")) {
    try {
      const data = JSON.parse(text) as { text?: unknown };
      if (typeof data.text === "string" && data.text.trim()) return data.text.trim();
    } catch {
      /* keep raw preview */
    }
  }
  return text;
}
