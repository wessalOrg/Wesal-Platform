"use client";

import { useCallback, useState } from "react";
import { useOptionalMessagesInbox } from "@/components/messages/MessagesInboxProvider";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useStartHallConversation } from "@/hooks/useStartHallConversation";
import { useT } from "@/i18n";
import { formatBookingDateLabel } from "@/lib/booking-date";
import { formatDepositAmount } from "@/lib/booking-deposits";
import { bookingWhenLabels } from "@/lib/booking-when-label";
import { localizeHallName } from "@/lib/localize-hall-display";
import { sendConversationMessage } from "@/services/conversations";
import type { UserBooking } from "@/types/booking";

function newClientRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `booking-chat-${Date.now()}`;
}

/**
 * Opens the seeker ↔ hall-owner thread for an accepted booking and
 * attaches booking metadata as composer draft (and a first message on new threads).
 */
export function useBookingOwnerChat() {
  const t = useT();
  const lang = useUiLang();
  const inbox = useOptionalMessagesInbox();
  const { start, starting, error } = useStartHallConversation();
  const [busyId, setBusyId] = useState<string | null>(null);

  const contextFor = useCallback(
    (booking: UserBooking) => {
      const locale = lang === "ar" ? "ar-EG" : "en-GB";
      const hallName =
        localizeHallName(booking.hallId, booking.hallName, lang) || t("common.hall");
      const when = bookingWhenLabels(booking, t, locale).join(" · ");
      const amount =
        booking.depositAmount != null ? ` (${formatDepositAmount(booking.depositAmount)})` : "";
      return t("bookings.paymentChat.context", {
        bookingId: booking.bookingId,
        hallName,
        date: formatBookingDateLabel(booking.date, locale),
        period: when || t("halls.period.generic"),
        amount,
      });
    },
    [lang, t],
  );

  const openForBooking = useCallback(
    async (booking: UserBooking) => {
      if (!booking.hallId || busyId || starting) return null;
      setBusyId(booking.bookingId);
      try {
        const draft = contextFor(booking);
        const thread = await start(booking.hallId);
        if (!thread) return null;
        if (thread.isExisting) {
          inbox?.openInbox(thread.conversationId, draft);
        } else {
          try {
            await sendConversationMessage(thread.conversationId, draft, newClientRequestId());
          } catch {
            inbox?.openInbox(thread.conversationId, draft);
          }
        }
        return thread;
      } finally {
        setBusyId(null);
      }
    },
    [busyId, contextFor, inbox, start, starting],
  );

  return {
    openForBooking,
    busyId,
    starting,
    error,
  };
}
