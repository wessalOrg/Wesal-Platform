"use client";

import HallMonthCalendar from "@/components/halls/HallMonthCalendar";
import HallHourlyRangePicker from "@/components/halls/hourly/HallHourlyRangePicker";
import HourlyBookingNameDialog from "@/components/halls/hourly/HourlyBookingNameDialog";
import { useEffect } from "react";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useHourlyBooking, type HourlySummarySelection } from "@/hooks/useHourlyBooking";
import { useT } from "@/i18n";
import { formatBookingDateLabel } from "@/lib/booking-date";

type HallHourlyBookingSectionProps = {
  hallId: string;
  hallName?: string;
  canSubmit: boolean;
  onConfirmed?: (selection: HourlySummarySelection | null) => void;
  onRegisterConfirm?: (open: () => void) => void;
};

export default function HallHourlyBookingSection({
  hallId,
  hallName,
  canSubmit,
  onConfirmed,
  onRegisterConfirm,
}: HallHourlyBookingSectionProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const booking = useHourlyBooking({ hallId, hallName, locale, canSubmit, onConfirmed });
  const errorText = booking.errorKey ? t(booking.errorKey) : null;

  useEffect(() => {
    onRegisterConfirm?.(booking.openPrompt);
  }, [booking.openPrompt, onRegisterConfirm]);

  return (
    <section
      id="hall-booking-section"
      className="hall-section-card hall-inline-booking"
      data-testid="hall-hourly-booking"
    >
      <h2 className="hall-section-title flex items-center gap-2">
        <img
          src="/icons/hourly-calendar.jpg"
          alt=""
          width={36}
          height={36}
          className="size-9 shrink-0 mix-blend-multiply"
        />
        <span>{t("halls.hourly.title")}</span>
      </h2>
      <p className="mt-1 text-sm text-[var(--wesal-muted)]">{t("halls.hourly.hint")}</p>
      {errorText && !booking.promptOpen ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {errorText}
        </p>
      ) : null}

      <div className="mt-5 space-y-5">
        <HallMonthCalendar
          dayStatuses={booking.dayStatuses}
          selectedDateIso={booking.dateIso}
          onSelect={(day) => {
            if (day.dateIso) booking.selectDate(day.dateIso);
          }}
          disabled={booking.submitting}
          locale={locale}
          legend="hourly"
        />

        {booking.dateIso ? (
          <div>
            <h3 className="mb-3 text-sm font-bold text-[var(--wesal-text)]">
              {t("halls.hourly.slotsFor", { date: booking.dateLabel })}
            </h3>
            {booking.slotsLoading ? (
              <p className="text-sm text-[var(--wesal-muted)]">{t("common.loading")}</p>
            ) : (
              <HallHourlyRangePicker
                from={booking.rangeFrom}
                to={booking.rangeTo}
                fromHours={booking.hourChoices.fromHours}
                toHours={booking.hourChoices.toHours}
                onFromChange={booking.setRangeFrom}
                onToChange={booking.setRangeTo}
                onApply={booking.confirmRange}
                disabled={booking.submitting}
              />
            )}
          </div>
        ) : null}
      </div>

      <HourlyBookingNameDialog
        open={booking.promptOpen}
        name={booking.name}
        phone={booking.phone}
        onNameChange={booking.setName}
        onPhoneChange={booking.setPhone}
        onClose={booking.closePrompt}
        onSubmit={() => {
          void booking.submit();
        }}
        submitting={booking.submitting}
        errorText={errorText}
        slotLabel={booking.selectedRangeLabel}
        dateLabel={booking.dateLabel || formatBookingDateLabel(booking.dateIso ?? "", locale)}
      />
    </section>
  );
}
