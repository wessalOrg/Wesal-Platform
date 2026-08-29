"use client";

import Link from "next/link";
import {
  criteriaLocation,
  formatRecommendationDate,
  periodMessageKey,
  regionMessageKey,
} from "@/components/assistant/ai-hall-recommendation-display";
import { useTranslateLang } from "@/i18n";
import type { AiExtractedCriteria } from "@/types/ai-chat";

type AiHallNoResultsProps = {
  criteria?: AiExtractedCriteria | null;
};

/** Polished empty recommend surface. Copy only — no search logic. */
export default function AiHallNoResults({ criteria = null }: AiHallNoResultsProps) {
  const { t, lang } = useTranslateLang();
  const locationRaw = criteriaLocation(criteria);
  const locationKey = regionMessageKey(locationRaw);
  const location = locationKey ? t(locationKey) : locationRaw;
  const dateLabel = formatRecommendationDate(criteria?.date, lang);
  const periodKey = periodMessageKey(criteria?.bookingPeriod);
  const periodLabel = periodKey ? t(periodKey) : criteria?.bookingPeriod;
  const context = [location, dateLabel, periodLabel].filter(Boolean).join(" · ");

  return (
    <div
      role="status"
      data-testid="ai-chat-no-results"
      className="wesal-ai-hall-empty rounded-2xl border border-dashed border-[var(--wesal-maroon-soft)] bg-white px-3.5 py-4 text-start"
    >
      <p className="text-[0.8rem] font-bold text-[var(--wesal-text)]">
        {t("assistant.chat.recommend.noResultsTitle")}
      </p>
      <p className="mt-1 text-[0.72rem] leading-5 text-[var(--wesal-muted)]">
        {context
          ? t("assistant.chat.recommend.noResultsContext", { context })
          : t("errors.assistant.chat.noResults")}
      </p>
      <Link
        href="/halls"
        className="mt-3 inline-flex text-[0.72rem] font-semibold text-[var(--wesal-maroon)] no-underline"
      >
        {t("assistant.browseHalls")}
      </Link>
    </div>
  );
}
