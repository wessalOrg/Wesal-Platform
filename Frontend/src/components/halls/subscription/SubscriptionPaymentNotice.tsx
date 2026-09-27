"use client";

import Link from "next/link";
import { useUiLang } from "@/components/layout/LanguageProvider";
import type { HallPaymentStatus } from "@/constants/hallPaymentStatus";
import { useT } from "@/i18n";
import { ownerAdminMessagesPath } from "@/lib/hall-owner-query-keys";
import { localizeHallName } from "@/lib/localize-hall-display";

type SubscriptionPaymentNoticeProps = {
  hallId: string;
  hallName: string;
  paymentStatus: HallPaymentStatus;
};

export default function SubscriptionPaymentNotice({
  hallId,
  hallName,
  paymentStatus,
}: SubscriptionPaymentNoticeProps) {
  const t = useT();
  const lang = useUiLang();
  const name = localizeHallName(hallId, hallName, lang).trim() || hallName;

  return (
    <aside
      className="rounded-2xl border border-[rgba(196,160,92,0.45)] bg-[rgba(196,160,92,0.12)] p-4 shadow-[0_8px_20px_rgba(90,55,45,0.06)] sm:p-5"
      role="status"
      data-testid="subscription-payment-notice"
      data-hall-id={hallId}
      data-payment-status={paymentStatus}
    >
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.04em] text-[var(--wesal-gold)]">
        {t("owner.subscription.paymentNotice.badge")}
      </p>
      {name ? (
        <p className="mt-1 break-words text-sm font-semibold text-[var(--wesal-text)] [overflow-wrap:anywhere]">
          {name}
        </p>
      ) : null}
      <p className="mt-2 break-words text-sm leading-7 text-[var(--wesal-text)]">
        {t("owner.subscription.paymentNotice.body")}
      </p>
      <div className="mt-4">
        <Link
          href={ownerAdminMessagesPath(hallId)}
          className="seeker-btn-primary inline-flex min-h-11 items-center"
          prefetch
          data-testid="subscription-payment-admin-chat-cta"
        >
          {t("owner.subscription.paymentNotice.contactAdmin")}
        </Link>
      </div>
    </aside>
  );
}
