"use client";

import { useAccountAccess } from "@/hooks/useAccountAccess";
import { useT } from "@/i18n";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { formatRelativeTime } from "@/lib/relative-time";
import {
  conversationAvatarInitials,
  conversationHallLabel,
  conversationListPreview,
  conversationPeerRoleLabel,
  conversationPreviewTitle,
} from "@/lib/conversation-display";
import { isAdminAccountConversation } from "@/lib/admin-account-conversation";
import { isOwnerAdminConversation, ownerConversationTitle } from "@/lib/owner-admin-conversation";
import { formatUnreadCount } from "@/lib/unread-badge";
import type { ConversationSummary } from "@/types/messages";

type ConversationListItemProps = {
  conversation: ConversationSummary;
  selected: boolean;
  variant?: "page" | "widget";
  onSelect: (conversationId: string) => void;
};

export default function ConversationListItem({
  conversation,
  selected,
  variant = "page",
  onSelect,
}: ConversationListItemProps) {
  const t = useT();
  const lang = useUiLang();
  const { isHallOwner, isAdmin, isProfessional } = useAccountAccess();
  const adminThread = isAdminAccountConversation(conversation);
  const peerIsAdmin = isOwnerAdminConversation(conversation);
  const title =
    isHallOwner || peerIsAdmin
      ? ownerConversationTitle(conversation, lang)
      : adminThread
        ? t("messages.adminChat.title")
        : conversationPreviewTitle(conversation, lang);
  const hall = peerIsAdmin || adminThread ? "" : conversationHallLabel(conversation, lang);
  const role = peerIsAdmin
    ? t("owner.messages.admin")
    : conversationPeerRoleLabel({
        viewerIsHallOwner: isHallOwner,
        viewerIsAdmin: isAdmin,
        peerIsAdmin: adminThread,
        peerIsCustomer: isProfessional && conversation.kind === "CustomerProvider",
      });
  const preview = conversationListPreview(
    conversation.lastMessagePreview,
    Boolean(conversation.lastMessageHasAttachment),
  );
  const time = formatRelativeTime(conversation.lastMessageAt ?? conversation.createdAt);
  const unreadCount = selected
    ? 0
    : Math.max(
        conversation.unreadMessageCount || 0,
        conversation.isUnread ? 1 : 0,
      );
  const unreadLabel = formatUnreadCount(unreadCount);
  const unread = Boolean(unreadLabel);
  const avatarUrl = conversation.otherParticipantAvatarUrl?.trim() || null;

  return (
    <button
      type="button"
      className={`flex w-full min-w-0 items-start gap-3 rounded-2xl px-3 py-3 text-start transition ${
        adminThread
          ? selected
            ? "border border-[var(--wesal-maroon)]/30 bg-[var(--wesal-pink)]"
            : "border border-transparent bg-[var(--wesal-pink-soft)]/80 hover:border-[var(--wesal-maroon)]/20"
          : selected
            ? variant === "widget"
              ? "bg-white shadow-[0_6px_16px_rgba(90,55,45,0.08)]"
              : "bg-[var(--wesal-pink)]"
            : variant === "widget"
              ? "hover:bg-white/80"
              : "hover:bg-[var(--wesal-pink)]/70"
      } ${unread ? "font-semibold" : ""}`}
      aria-current={selected ? "true" : undefined}
      data-testid="inbox-conversation"
      data-conversation-id={conversation.conversationId}
      data-kind={conversation.kind ?? undefined}
      data-admin={adminThread ? "true" : "false"}
      data-unread={unread ? "true" : "false"}
      onClick={() => onSelect(conversation.conversationId)}
    >
      <span
        className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--wesal-maroon)] text-xs font-bold text-white"
        aria-hidden="true"
      >
        {avatarUrl && !adminThread ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          conversationAvatarInitials(title)
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold text-[var(--wesal-maroon)]">{title}</span>
          {time ? (
            <span className="shrink-0 text-[0.68rem] font-normal text-[var(--wesal-muted)]">{time}</span>
          ) : null}
        </span>
        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
          {hall && !adminThread ? (
            <span className="max-w-full truncate rounded-full bg-[var(--wesal-pink-soft)] px-2 py-0.5 text-[0.65rem] font-semibold text-[var(--wesal-maroon)]">
              {hall}
            </span>
          ) : null}
          <span
            className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-medium ${
              adminThread
                ? "border-[var(--wesal-maroon)]/35 bg-white text-[var(--wesal-maroon)]"
                : "border-[var(--wesal-border)] text-[var(--wesal-muted)]"
            }`}
          >
            {role}
          </span>
        </span>
        <span className="mt-1 flex min-w-0 items-start gap-2">
          <span className="line-clamp-2 min-w-0 flex-1 text-xs font-normal leading-5 text-[var(--wesal-text)]">
            {preview || t("messages.previewEmpty")}
          </span>
          {unreadLabel ? (
            <span
              className="mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#c62828] px-1 text-[0.65rem] font-bold text-white"
              aria-label={t("messages.unreadCount", { count: unreadCount })}
              data-testid="inbox-unread-badge"
            >
              {unreadLabel}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
