"use client";

import OccasionTypePicker from "@/components/halls/hourly/OccasionTypePicker";
import { useT } from "@/i18n";
import type { OccasionTypeKey } from "@/lib/occasion-types";

type HourlyBookingNameDialogProps = {
  open: boolean;
  /** Prefills from the signed-in profile; editable for this booking. */
  name: string;
  onNameChange: (value: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  eventType: string;
  onEventTypeChange: (value: OccasionTypeKey) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  errorText: string | null;
  slotLabel: string;
  dateLabel: string;
};

export default function HourlyBookingNameDialog({
  open,
  name,
  onNameChange,
  phone,
  onPhoneChange,
  eventType,
  onEventTypeChange,
  onClose,
  onSubmit,
  submitting,
  errorText,
  slotLabel,
  dateLabel,
}: HourlyBookingNameDialogProps) {
  const t = useT();
  if (!open) return null;

  const canSubmit =
    Boolean(name.trim()) && Boolean(phone.trim()) && Boolean(eventType.trim());

  return (
    <div className="fixed inset-0 z-[120]" role="presentation" data-testid="hourly-name-dialog">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(40,25,20,0.45)]"
        aria-label={t("common.close")}
        onClick={onClose}
        disabled={submitting}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hourly-name-title"
        className="hourly-name-dialog absolute inset-x-4 top-1/2 mx-auto max-h-[min(92vh,44rem)] w-full max-w-md -translate-y-1/2 overflow-y-auto rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-white)] p-5 shadow-[0_24px_60px_rgba(60,35,30,0.22)]"
      >
        <h3 id="hourly-name-title" className="text-base font-bold text-[var(--wesal-text)]">
          {t("halls.hourly.confirmTitle")}
        </h3>
        <p className="mt-1 text-sm text-[var(--wesal-muted)]">
          {dateLabel}
          {slotLabel ? (
            <>
              {" · "}
              <span dir="ltr" className="inline-block whitespace-nowrap tabular-nums">
                {slotLabel}
              </span>
            </>
          ) : null}
        </p>
        <label className="mt-4 block text-sm font-semibold text-[var(--wesal-text)]" htmlFor="hourly-name">
          {t("halls.hourly.bookingAs")}
        </label>
        <input
          id="hourly-name"
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          autoComplete="name"
          className="mt-1.5 w-full rounded-xl border border-[var(--wesal-border)] bg-[var(--wesal-white)] px-3 py-2.5 text-sm text-[var(--wesal-text)] outline-none focus:border-[var(--wesal-maroon)]"
          disabled={submitting}
          data-testid="hourly-account-name"
        />
        <label className="mt-4 block text-sm font-semibold text-[var(--wesal-text)]" htmlFor="hourly-phone">
          {t("halls.hourly.phone")}
        </label>
        <input
          id="hourly-phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          value={phone}
          onChange={(event) => onPhoneChange(event.target.value)}
          autoComplete="tel"
          placeholder="05xxxxxxxx"
          className="mt-1.5 w-full rounded-xl border border-[var(--wesal-border)] bg-[var(--wesal-white)] px-3 py-2.5 text-sm text-[var(--wesal-text)] outline-none focus:border-[var(--wesal-maroon)] rtl:text-right"
          disabled={submitting}
          data-testid="hourly-phone-input"
        />
        <p className="mt-1.5 text-xs text-[var(--wesal-muted)]">{t("halls.hourly.phoneHint")}</p>

        <label
          className="mt-4 block text-sm font-semibold text-[var(--wesal-text)]"
          htmlFor="hourly-event-type"
        >
          {t("halls.hourly.eventType")}
        </label>
        <OccasionTypePicker
          id="hourly-event-type"
          value={eventType}
          onChange={onEventTypeChange}
          disabled={submitting}
        />

        {errorText ? (
          <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {errorText}
          </p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn-outline flex-1" onClick={onClose} disabled={submitting}>
            {t("common.close")}
          </button>
          <button
            type="button"
            className="btn-primary flex-1 disabled:opacity-60"
            onClick={onSubmit}
            disabled={submitting || !canSubmit}
            data-testid="hourly-name-submit"
          >
            {submitting ? t("halls.booking.submitting") : t("halls.booking.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
