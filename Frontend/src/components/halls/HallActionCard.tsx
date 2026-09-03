"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useT } from "@/i18n";
import type { HallSlotPrice } from "@/types/hall";

type HallActionCardProps = {
  slotPrices: HallSlotPrice[];
  onBook: () => void;
  disabled?: boolean;
  bookPending?: boolean;
  isGuest?: boolean;
  canBook?: boolean;
  showContact?: boolean;
  loginHref?: string;
  registerHref?: string;
  onGuestAuthNavigate?: () => void;
  contactSlot?: ReactNode;
};

export default function HallActionCard({
  slotPrices,
  onBook,
  disabled = false,
  bookPending = false,
  isGuest = false,
  canBook = false,
  showContact = false,
  loginHref = "/login",
  registerHref = "/register",
  onGuestAuthNavigate,
  contactSlot,
}: HallActionCardProps) {
  const t = useT();
  const showGuestAuth = isGuest && !disabled;

  return (
    <aside
      className="hall-action-card w-full rounded-2xl border border-[var(--wesal-border)] bg-white p-5 shadow-[0_14px_40px_rgba(90,55,45,0.1)]"
      data-testid="hall-action-card"
    >
      <h2 className="text-base font-bold text-[var(--wesal-text)]">
        {t("halls.details.slotPrices")}
      </h2>

      <ul className="mt-4 space-y-3">
        {slotPrices.length ? (
          slotPrices.map((slot) => (
            <li
              key={slot.label}
              className="flex items-center justify-between gap-3 rounded-xl bg-[var(--wesal-pink-soft)] px-3.5 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--wesal-text)]">{slot.label}</p>
                {slot.time ? (
                  <p className="mt-0.5 text-xs text-[var(--wesal-muted)]">{slot.time}</p>
                ) : null}
              </div>
              <span className="hall-price-badge shrink-0 text-xs">
                {slot.priceLabel ??
                  (slot.price != null ? `${slot.price.toLocaleString("en-US")} ₪` : "—")}
              </span>
            </li>
          ))
        ) : (
          <li className="rounded-xl bg-[var(--wesal-pink-soft)] px-3.5 py-3 text-sm text-[var(--wesal-muted)]">
            {t("halls.booking.emptyDays")}
          </li>
        )}
      </ul>

      {showGuestAuth ? (
        <p className="mt-4 text-xs leading-6 text-[var(--wesal-muted)]">
          {t("halls.details.guestBookingHint")}
        </p>
      ) : null}

      {canBook || showGuestAuth || showContact ? (
        <div className="mt-5 space-y-2.5">
          {canBook ? (
            <button
              type="button"
              onClick={onBook}
              disabled={disabled || bookPending}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="hall-book-button"
            >
              {bookPending ? t("common.loading") : t("halls.details.pressToBook")}
            </button>
          ) : null}

          {showGuestAuth ? (
            <div className="grid grid-cols-2 gap-2">
              <Link
                href={loginHref}
                onClick={onGuestAuthNavigate}
                className="btn-outline w-full text-center text-xs sm:text-sm"
              >
                {t("nav.login")}
              </Link>
              <Link
                href={registerHref}
                onClick={onGuestAuthNavigate}
                className="btn-outline w-full text-center text-xs sm:text-sm"
              >
                {t("nav.register")}
              </Link>
            </div>
          ) : null}

          {showContact ? contactSlot : null}
        </div>
      ) : null}
    </aside>
  );
}
