"use client";

import Link from "next/link";
import { useT } from "@/i18n";
import type { HallSlotPrice } from "@/types/hall";

type HallActionCardProps = {
  hallName: string;
  capacity?: number | null;
  capacityMax?: number | null;
  /** @deprecated Prefer capacity + capacityMax for correct RTL range order. */
  capacityLabel?: string | null;
  slotPrices: HallSlotPrice[];
  selectedDateLabel?: string | null;
  selectedPeriodLabels?: string[];
  priceSummary?: string | null;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  confirmPending?: boolean;
  confirmSuccess?: boolean;
  confirmError?: string | null;
  disabled?: boolean;
  bookPending?: boolean;
  isGuest?: boolean;
  canBook?: boolean;
  loginHref?: string;
  registerHref?: string;
  onGuestAuthNavigate?: () => void;
};

function CapacityRangeValue({
  capacity,
  capacityMax,
  peopleWord,
}: {
  capacity: number;
  capacityMax?: number | null;
  peopleWord: string;
}) {
  const hasRange = capacityMax != null && capacityMax !== capacity;
  const low = hasRange ? Math.min(capacity, capacityMax) : capacity;
  const high = hasRange ? Math.max(capacity, capacityMax!) : null;

  return (
    <span className="inline-flex items-baseline gap-1">
      {high != null ? (
        <span className="inline-flex items-baseline tabular-nums" dir="rtl">
          <span>{low}</span>
          <span>-</span>
          <span>{high}</span>
        </span>
      ) : (
        <span className="tabular-nums">{low}</span>
      )}
      <span>{peopleWord}</span>
    </span>
  );
}

function fallbackPrice(slotPrices: HallSlotPrice[]): string {
  const priced = slotPrices
    .map((slot) => slot.price)
    .filter((price): price is number => typeof price === "number" && Number.isFinite(price));
  if (priced.length) {
    return `${Math.min(...priced).toLocaleString("en-US")} ₪`;
  }
  return slotPrices.find((slot) => slot.priceLabel?.trim())?.priceLabel?.trim() || "—";
}

export default function HallActionCard({
  hallName,
  capacity = null,
  capacityMax = null,
  capacityLabel = null,
  slotPrices,
  selectedDateLabel = null,
  selectedPeriodLabels = [],
  priceSummary = null,
  onConfirm,
  confirmDisabled = true,
  confirmPending = false,
  confirmSuccess = false,
  confirmError = null,
  disabled = false,
  bookPending = false,
  isGuest = false,
  canBook = false,
  loginHref = "/login",
  registerHref = "/register",
  onGuestAuthNavigate,
}: HallActionCardProps) {
  const t = useT();
  const showGuestAuth = isGuest && !disabled;
  const price = priceSummary?.trim() || fallbackPrice(slotPrices);
  const dateValue = selectedDateLabel?.trim() || t("halls.details.summaryPickDate");
  const periodValue =
    selectedPeriodLabels.length > 0
      ? selectedPeriodLabels.join(" · ")
      : t("halls.details.summaryPickPeriod");
  const showCapacity = capacity != null || Boolean(capacityLabel);

  return (
    <aside
      className="hall-action-card hall-section-card hall-booking-summary relative flex h-full w-full flex-col"
      data-testid="hall-action-card"
    >
      <h2 className="hall-section-title">{t("halls.details.bookingSummary")}</h2>

      <p className="mt-4 text-sm font-bold text-[var(--wesal-text)]">
        {t("halls.details.summaryDetails")}
      </p>

      <dl className="mt-3 divide-y divide-[var(--wesal-border)]/80 text-sm">
        <div className="flex items-start justify-between gap-3 py-2.5">
          <dt className="text-[var(--wesal-muted)]">{t("halls.details.summaryHall")}</dt>
          <dd className="max-w-[58%] text-end font-semibold text-[var(--wesal-text)]">
            {hallName}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3 py-2.5">
          <dt className="text-[var(--wesal-muted)]">{t("halls.details.summaryDate")}</dt>
          <dd className="max-w-[58%] text-end font-semibold text-[var(--wesal-text)]">
            {dateValue}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3 py-2.5">
          <dt className="text-[var(--wesal-muted)]">{t("halls.details.summaryPeriod")}</dt>
          <dd className="max-w-[58%] text-end font-semibold text-[var(--wesal-text)]">
            {periodValue}
          </dd>
        </div>
        {showCapacity ? (
          <div className="flex items-start justify-between gap-3 py-2.5">
            <dt className="text-[var(--wesal-muted)]">{t("halls.details.capacity")}</dt>
            <dd className="max-w-[58%] text-end font-semibold text-[var(--wesal-text)]">
              {capacity != null ? (
                <CapacityRangeValue
                  capacity={capacity}
                  capacityMax={capacityMax}
                  peopleWord={t("halls.details.people")}
                />
              ) : (
                capacityLabel
              )}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 rounded-xl bg-[var(--wesal-pink-soft)] px-3.5 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--wesal-muted)]">
            {t("halls.details.summaryTotal")}
          </p>
          <p className="text-base font-extrabold text-[var(--wesal-maroon)]">{price}</p>
        </div>
        <p className="mt-2 text-[0.7rem] leading-5 text-[var(--wesal-muted)]">
          {t("halls.details.summaryPriceNote")}
        </p>
      </div>

      {showGuestAuth ? (
        <p className="mt-4 text-xs leading-6 text-[var(--wesal-muted)]">
          {t("halls.details.guestBookingHint")}
        </p>
      ) : null}

      {confirmError ? (
        <p
          className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
          data-testid="hall-booking-error"
        >
          {confirmError}
        </p>
      ) : null}

      {confirmSuccess ? (
        <p
          className="mt-4 rounded-xl bg-[var(--wesal-pink-soft)] px-3 py-2 text-sm font-semibold text-[var(--wesal-maroon)]"
          role="status"
        >
          {t("halls.booking.success")}
        </p>
      ) : null}

      {canBook || showGuestAuth ? (
        <div className="mt-auto space-y-2.5 pt-5">
          {canBook ? (
            <button
              type="button"
              onClick={onConfirm}
              disabled={
                disabled || bookPending || confirmDisabled || confirmPending || confirmSuccess
              }
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="hall-book-button"
              aria-busy={confirmPending || undefined}
            >
              {confirmPending
                ? t("halls.booking.submitting")
                : bookPending
                  ? t("common.loading")
                  : t("halls.details.confirmBooking")}
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
        </div>
      ) : null}
    </aside>
  );
}
