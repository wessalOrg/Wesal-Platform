"use client";

import {
  formatRecommendationDate,
  periodMessageKey,
} from "@/components/assistant/ai-hall-recommendation-display";
import { useTranslateLang } from "@/i18n";
import type { AiAvailabilityPeriod, AiHallAvailability } from "@/types/ai-chat";

type AiHallAvailabilityCardProps = {
  availability: AiHallAvailability;
};

function periodTime(period: AiAvailabilityPeriod): string {
  const start = period.startTime ? period.startTime.slice(0, 5) : "";
  const end = period.endTime ? period.endTime.slice(0, 5) : "";
  if (start && end) return `${start} – ${end}`;
  return start || end;
}

/** Structured per-period availability for one hall and date. Presentation only. */
export default function AiHallAvailabilityCard({
  availability,
}: AiHallAvailabilityCardProps) {
  const { t, lang } = useTranslateLang();
  const dateLabel = formatRecommendationDate(availability.date || null, lang);
  const periods = availability.periods ?? [];

  return (
    <div
      role="status"
      data-testid="ai-chat-availability"
      className="mt-2 rounded-2xl border border-[var(--wesal-border)] bg-[#fbf7f2] px-3.5 py-3"
    >
      <p className="text-[0.78rem] font-bold leading-5 text-[var(--wesal-text)]">
        {t("assistant.chat.availability.title", {
          name: availability.hallName || t("common.hall"),
          date: dateLabel ?? "",
        })}
      </p>
      {periods.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {periods.map((period) => {
            const periodKey = periodMessageKey(period.periodType);
            const periodLabel = periodKey ? t(periodKey) : period.periodName || "";
            const booked = period.status === "Booked";
            return (
              <li
                key={`${period.periodType}-${period.startTime}-${period.endTime}`}
                className="flex items-center justify-between gap-2 text-[0.72rem] leading-5"
              >
                <span className="font-semibold text-[var(--wesal-text)]">
                  {periodLabel}
                </span>
                <span className="text-[var(--wesal-muted)]">
                  {periodTime(period)}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-semibold ${
                    booked
                      ? "bg-[#f8e8e6] text-[var(--wesal-maroon)]"
                      : "bg-[#e7f6ee] text-[#2f7d56]"
                  }`}
                >
                  {booked
                    ? t("assistant.chat.availability.booked")
                    : t("assistant.chat.available")}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}