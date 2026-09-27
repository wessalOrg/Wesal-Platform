"use client";

import { useMemo } from "react";
import { useHallNotifications } from "@/hooks/useHallNotifications";
import { usePublishBooking } from "@/hooks/usePublishBooking";
import { useT } from "@/i18n";
import { formatBookingDateLabel } from "@/lib/booking-date";
import { formatDepositAmount } from "@/lib/booking-deposits";
import { bookingWhenLabels } from "@/lib/booking-when-label";
import { useUiLang } from "@/components/layout/LanguageProvider";

type OwnerConfirmPaymentBarProps = {
  hallId?: string | null;
  requesterUserId?: string | null;
};

export default function OwnerConfirmPaymentBar({
  hallId,
  requesterUserId,
}: OwnerConfirmPaymentBarProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const scopedHallId = hallId?.trim() || "";
  const peerId = requesterUserId?.trim() || "";
  const notifications = useHallNotifications(scopedHallId, Boolean(scopedHallId && peerId));
  const confirm = usePublishBooking({
    onPublished: notifications.applyPublished,
    onStatusSync: notifications.applyStatus,
  });

  const pending = useMemo(
    () =>
      notifications.items.filter(
        (item) =>
          item.status === "AcceptedPendingDeposit" && item.requesterUserId === peerId,
      ),
    [notifications.items, peerId],
  );

  if (!scopedHallId || !peerId || pending.length === 0) return null;

  return (
    <div className="space-y-2 rounded-xl border border-[rgba(196,160,92,0.4)] bg-white px-3 py-3" data-testid="owner-confirm-payment-bar">
      {pending.map((item) => {
        const when = bookingWhenLabels(item, t, locale).join(" · ");
        const amount =
          item.depositAmount != null ? formatDepositAmount(item.depositAmount) : "";
        const busy = confirm.publishingId === item.id;
        return (
          <div key={item.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-[var(--wesal-text)]">
              {t("owner.notifications.confirmPaymentHint", {
                date: item.date ? formatBookingDateLabel(item.date, locale) : "",
                when,
                amount,
              })}
            </p>
            <button
              type="button"
              className="btn-primary !min-h-10 shrink-0 text-sm"
              disabled={Boolean(confirm.publishingId)}
              aria-busy={busy || undefined}
              data-testid={`thread-confirm-payment-${item.id}`}
              onClick={() => {
                void confirm.publish(item.hallId || scopedHallId, item.id);
              }}
            >
              {busy
                ? t("owner.notifications.confirmingPayment")
                : t("owner.notifications.confirmPayment")}
            </button>
          </div>
        );
      })}
      {confirm.publishingId && confirm.errorById[confirm.publishingId] ? (
        <p className="text-sm text-red-700" role="alert">
          {confirm.errorById[confirm.publishingId].startsWith("errors.") ||
          confirm.errorById[confirm.publishingId].startsWith("owner.")
            ? t(confirm.errorById[confirm.publishingId])
            : confirm.errorById[confirm.publishingId]}
        </p>
      ) : null}
    </div>
  );
}
