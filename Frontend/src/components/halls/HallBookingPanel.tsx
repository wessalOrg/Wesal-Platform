"use client";

import { useEffect } from "react";
import HallBookingDateList from "@/components/halls/HallBookingDateList";
import HallBookingPeriodList from "@/components/halls/HallBookingPeriodList";
import CreatedBookingCancelList from "@/components/bookings/CreatedBookingCancelList";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import { useBookingInteraction } from "@/hooks/useBookingInteraction";
import { useBookingRequestForm } from "@/hooks/useBookingRequestForm";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import { inferBookingPeriodType } from "@/lib/booking-period";
import type { BookingRequestResult } from "@/types/booking";
import type { HallAvailabilityDay } from "@/types/hall";

type HallBookingPanelProps = {
  open: boolean;
  hallId: string;
  hallName: string;
  days: HallAvailabilityDay[];
  canSubmit: boolean;
  onClose: () => void;
  onSubmitted?: (result: BookingRequestResult) => void;
};

export default function HallBookingPanel({
  open,
  hallId,
  hallName,
  days,
  canSubmit,
  onClose,
  onSubmitted,
}: HallBookingPanelProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const { displayName, canOpenRegularProfile } = useUserIdentity();
  const form = useBookingRequestForm({
    hallId,
    days,
    open,
    locale,
    canSubmit,
    onSubmitted,
  });
  const interaction = useBookingInteraction({
    canSubmit,
    dateIso: form.dateIso,
    periods: form.periods,
    periodsLoading: form.periodsLoading,
    periodsError: form.periodsError,
    selectedCount: form.selectedPeriods.length,
    submitting: form.submitting,
    success: Boolean(form.success),
    errorKey: form.errorKey,
  });

  useEffect(() => {
    if (!open) return;

    lockBodyScroll();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !form.submitting) onClose();
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
    };
  }, [open, onClose, form.submitting]);

  if (!open) return null;

  const selectedLabels = form.periods
    .filter((period) => {
      const type = period.periodType ?? inferBookingPeriodType(period);
      return type && form.selectedPeriods.includes(type);
    })
    .map((period) => period.label);

  const errorText = form.errorKey
    ? form.errorKey.startsWith("errors.") || form.errorKey.startsWith("halls.")
      ? t(form.errorKey)
      : form.errorKey
    : null;

  const footerHint =
    interaction.phase === "all_unavailable"
      ? t("halls.booking.allUnavailable")
      : interaction.phase === "empty"
        ? t("halls.booking.noPeriods")
        : form.dateIso && form.selectedPeriods.length > 0
          ? null
          : form.dateIso
            ? t("halls.booking.pickHint")
            : t("halls.booking.pickDateFirst");

  return (
    <div
      className="hall-booking-overlay fixed inset-0 z-[110] overflow-y-auto overscroll-contain"
      role="presentation"
      data-testid="hall-booking-panel"
      data-booking-phase={interaction.phase}
      data-booking-layout={interaction.viewport}
    >
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4 lg:p-6">
        <button
          type="button"
          className="fixed inset-0 bg-[rgba(40,25,20,0.5)] backdrop-blur-[2px]"
          aria-label={t("common.close")}
          onClick={() => {
            if (!form.submitting) onClose();
          }}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hall-booking-panel-title"
          className="hall-booking-panel relative z-10 flex max-h-[92dvh] w-full max-w-none flex-col overflow-hidden rounded-t-2xl border border-[var(--wesal-border)] bg-white shadow-[0_24px_60px_rgba(60,35,30,0.22)] sm:my-auto sm:max-h-[min(88dvh,52rem)] sm:max-w-2xl sm:rounded-2xl lg:max-w-3xl"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--wesal-border)] px-4 py-3 sm:px-5 sm:py-4">
            <div className="min-w-0">
              <h2
                id="hall-booking-panel-title"
                className="text-base font-bold text-[var(--wesal-text)] sm:text-lg"
              >
                {t("halls.booking.title")}
              </h2>
              <p className="mt-1 truncate text-sm text-[var(--wesal-muted)]">{hallName}</p>
              {canOpenRegularProfile && displayName ? (
                <p
                  className="mt-0.5 truncate text-sm text-[var(--wesal-muted)]"
                  data-testid="hall-booking-identity"
                >
                  {t("halls.booking.asUser", { name: displayName })}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={form.submitting}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-pink-soft)] text-[var(--wesal-maroon)] transition hover:bg-[var(--wesal-pink)] disabled:opacity-60"
              aria-label={t("common.close")}
            >
              ✕
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {!interaction.showForm ? (
              interaction.phase === "restricted" ? (
                <p
                  className="rounded-2xl bg-[var(--wesal-pink-soft)] px-4 py-3 text-sm leading-7 text-[var(--wesal-text)]"
                  role="status"
                  data-testid="hall-booking-restricted"
                >
                  {t("halls.booking.restricted")}
                </p>
              ) : (
                <div
                  className="rounded-2xl bg-[var(--wesal-pink-soft)] px-4 py-4"
                  role="status"
                  data-testid="hall-booking-success"
                >
                  <p className="text-sm font-semibold text-[var(--wesal-maroon)]">
                    {t("halls.booking.success")}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[var(--wesal-text)]">
                    {t("halls.booking.successDetail", {
                      date: form.dateLabel,
                      periods: selectedLabels.join(" · ") || form.dateLabel,
                    })}
                  </p>
                  {form.success ? <CreatedBookingCancelList result={form.success} /> : null}
                </div>
              )
            ) : (
              <div className="space-y-5">
                <HallBookingDateList
                  days={form.futureDays}
                  selectedDateIso={form.dateIso}
                  onSelect={form.selectDate}
                  disabled={form.submitting}
                  locale={locale}
                  viewport={interaction.viewport}
                />
                {interaction.showPeriodArea ? (
                  <HallBookingPeriodList
                    periods={form.periods}
                    selected={form.selectedPeriods}
                    onToggle={form.togglePeriod}
                    loading={form.periodsLoading}
                    disabled={form.submitting}
                    error={form.periodsError}
                    phase={interaction.phase}
                    availabilityKind={interaction.availabilityKind}
                  />
                ) : (
                  <p className="text-sm text-[var(--wesal-muted)]">{t("halls.booking.pickDateFirst")}</p>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4">
            {interaction.phase === "success" ? (
              <button
                type="button"
                onClick={onClose}
                className="btn-primary w-full"
                data-testid="hall-booking-success-close"
              >
                {t("common.close")}
              </button>
            ) : interaction.showSubmit ? (
              <>
                {form.dateIso && form.selectedPeriods.length > 0 ? (
                  <p className="mb-3 text-sm text-[var(--wesal-text)]">
                    {t("halls.booking.selected")}{" "}
                    <span className="font-semibold text-[var(--wesal-maroon)]">
                      {form.dateLabel}
                      {selectedLabels.length ? ` · ${selectedLabels.join(" · ")}` : ""}
                    </span>
                  </p>
                ) : (
                  <p className="mb-3 text-sm text-[var(--wesal-muted)]">{footerHint}</p>
                )}
                {errorText &&
                (interaction.phase === "conflict" || interaction.phase === "validation_error") ? (
                  <p
                    className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
                    role="alert"
                    data-testid="hall-booking-error"
                  >
                    {errorText}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void form.submit()}
                  disabled={interaction.submitDisabled}
                  className="btn-primary min-h-11 w-full disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-12"
                  aria-busy={form.submitting}
                  data-testid="hall-booking-confirm"
                >
                  {form.submitting ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Spinner />
                      {t("halls.booking.submitting")}
                    </span>
                  ) : (
                    t("halls.booking.submit")
                  )}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
