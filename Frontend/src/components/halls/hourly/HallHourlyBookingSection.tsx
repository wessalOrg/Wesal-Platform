"use client";

import HallMonthCalendar from "@/components/halls/HallMonthCalendar";
import HallHourlySlotTable from "@/components/halls/hourly/HallHourlySlotTable";
import HourlyBookingNameDialog from "@/components/halls/hourly/HourlyBookingNameDialog";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useHourlyBooking } from "@/hooks/useHourlyBooking";
import { useT } from "@/i18n";
import { formatBookingDateLabel } from "@/lib/booking-date";

type HallHourlyBookingSectionProps = {
  hallId: string;
  hallName?: string;
  canSubmit: boolean;
};

export default function HallHourlyBookingSection({
  hallId,
  hallName,
  canSubmit,
}: HallHourlyBookingSectionProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const booking = useHourlyBooking({ hallId, hallName, locale, canSubmit });
  const errorText = booking.errorKey ? t(booking.errorKey) : null;

  return (
    <section
      id="hall-booking-section"
      className="hall-section-card hall-inline-booking"
      data-testid="hall-hourly-booking"
    >
      <h2 className="hall-section-title">{t("halls.hourly.title")}</h2>
      <p className="mt-1 text-sm text-[var(--wesal-muted)]">{t("halls.hourly.hint")}</p>

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
              <HallHourlySlotTable
                slots={booking.slots}
                selectedStart={booking.selectedSlot?.start ?? null}
                onSelect={booking.selectSlot}
                disabled={!canSubmit || booking.submitting}
              />
            )}
          </div>
        ) : null}
      </div>

      <HourlyBookingNameDialog
        open={booking.promptOpen}
        name={booking.name}
        onNameChange={booking.setName}
        onClose={booking.closePrompt}
        onSubmit={() => {
          void booking.submit();
        }}
        submitting={booking.submitting}
        errorText={errorText}
        slotLabel={booking.selectedSlot?.label ?? ""}
        dateLabel={booking.dateLabel || formatBookingDateLabel(booking.dateIso ?? "", locale)}
      />
    </section>
  );
}
