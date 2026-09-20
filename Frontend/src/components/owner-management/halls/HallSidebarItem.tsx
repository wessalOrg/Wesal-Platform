"use client";

import Link from "next/link";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { getHallPaymentStatusConfig } from "@/constants/hallPaymentStatus";
import { useT } from "@/i18n";
import { ownerHallPath } from "@/lib/hall-owner-query-keys";
import { localizeHallName } from "@/lib/localize-hall-display";
import type { HallOwnerHall } from "@/types/hall-owner-halls";

type HallSidebarItemProps = {
  hall: HallOwnerHall;
  active: boolean;
  onNavigate?: () => void;
  /** Adds the payment-status chip (used on the my-halls list; hidden in the sidebar). */
  compact?: boolean;
};

const STATUS_TONE_CLASS: Record<string, string> = {
  bad: "bg-[#fdecea] text-[#c45b55]",
  wait: "bg-[#fdf6e3] text-[#8a6d1a]",
  ok: "bg-[#e8f4e4] text-[#2e7d32]",
  unknown: "bg-[#efefef] text-[var(--wesal-muted)]",
};

export default function HallSidebarItem({
  hall,
  active,
  onNavigate,
  compact = false,
}: HallSidebarItemProps) {
  const t = useT();
  const lang = useUiLang();
  const name = localizeHallName(hall.id, hall.name, lang);
  const payment = getHallPaymentStatusConfig(hall.paymentStatus);

  return (
    <Link
      href={ownerHallPath(hall.id)}
      prefetch
      className={`owner-hall-sidebar-item${active ? " owner-hall-sidebar-item--active" : ""}`}
      aria-current={active ? "page" : undefined}
      data-testid={`owner-hall-sidebar-item-${hall.id}`}
      data-hall-id={hall.id}
      title={name}
      onClick={onNavigate}
    >
      <span className="owner-hall-sidebar-item-name">{name}</span>
      {!compact ? (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-4 ${STATUS_TONE_CLASS[payment.tone]}`}
          data-payment-status={hall.paymentStatus}
        >
          {t(payment.labelKey)}
        </span>
      ) : null}
    </Link>
  );
}