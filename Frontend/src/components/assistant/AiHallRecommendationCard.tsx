"use client";

import HallImage from "@/components/halls/HallImage";
import {
  formatRecommendationDate,
  formatRecommendationPrice,
  hasRequestedSlot,
  periodMessageKey,
  regionMessageKey,
} from "@/components/assistant/ai-hall-recommendation-display";
import { isNavigableHallId } from "@/components/assistant/ai-hall-navigation";
import { useTranslateLang } from "@/i18n";
import type { AiExtractedCriteria, AiRecommendedHall } from "@/types/ai-chat";

type AiHallRecommendationCardProps = {
  hall: AiRecommendedHall;
  criteria?: AiExtractedCriteria | null;
  pending?: boolean;
  noticeKey?: string | null;
  onOpen: (hallId: string) => void;
  onPrefetch?: (hallId: string) => void;
};

/**
 * Interactive recommendation row. Click handling is injected so this file stays
 * presentational and the chat hook never owns routing.
 */
export default function AiHallRecommendationCard({
  hall,
  criteria = null,
  pending = false,
  noticeKey = null,
  onOpen,
  onPrefetch,
}: AiHallRecommendationCardProps) {
  const { t, lang } = useTranslateLang();
  const canOpen = isNavigableHallId(hall.hallId);
  const regionKey = regionMessageKey(hall.region);
  const location = [regionKey ? t(regionKey) : hall.region, hall.address]
    .filter(Boolean)
    .join(" · ");
  const periodKey = periodMessageKey(criteria?.bookingPeriod);
  const dateLabel = formatRecommendationDate(criteria?.date, lang);
  const periodLabel = periodKey ? t(periodKey) : criteria?.bookingPeriod;
  const slotLabel = [dateLabel, periodLabel].filter(Boolean).join(" · ");
  const priceLabel = formatRecommendationPrice(hall.price);
  const available = hall.isAvailable;
  const availabilityLabel = available
    ? hasRequestedSlot(criteria)
      ? t("assistant.chat.recommend.availableForDate")
      : t("assistant.chat.available")
    : hall.unavailableReason || t("assistant.chat.unavailableHall");
  const name = hall.hallName || t("common.hall");
  const locked = !canOpen || pending;

  const open = () => {
    if (locked) return;
    onOpen(hall.hallId);
  };

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={open}
        onMouseEnter={() => {
          if (canOpen) onPrefetch?.(hall.hallId);
        }}
        onFocus={() => {
          if (canOpen) onPrefetch?.(hall.hallId);
        }}
        disabled={locked}
        aria-busy={pending}
        aria-disabled={!canOpen}
        aria-label={
          canOpen
            ? t("assistant.chat.recommend.openHall", { name })
            : t("assistant.chat.recommend.invalidHall")
        }
        data-testid="ai-chat-hall"
        data-available={available ? "true" : "false"}
        className="wesal-ai-hall wesal-ai-hall-card flex min-h-11 w-full min-w-0 items-stretch gap-3 rounded-2xl border border-[var(--wesal-border)] bg-white p-2.5 text-start no-underline transition hover:border-[var(--wesal-maroon-soft)] focus-visible:border-[var(--wesal-maroon)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon-soft)] disabled:cursor-not-allowed disabled:opacity-70 sm:min-h-12 sm:p-3"
      >
        <span className="wesal-ai-hall-thumb relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--wesal-pink)] sm:h-[4.25rem] sm:w-[4.25rem]">
          <HallImage
            src={hall.mainImage ?? ""}
            alt=""
            fill
            className="object-cover"
            sizes="68px"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="block min-w-0 text-[0.8rem] font-bold leading-5 text-[var(--wesal-text)]">
              {name}
            </span>
            <span
              className={`wesal-ai-hall-badge shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-semibold ${
                available
                  ? "bg-[#e7f6ee] text-[#2f7d56]"
                  : "bg-[#f8e8e6] text-[var(--wesal-maroon)]"
              }`}
            >
              {available
                ? t("assistant.chat.available")
                : t("assistant.chat.unavailableHall")}
            </span>
          </span>
          {location ? (
            <span className="mt-0.5 block text-[0.7rem] leading-5 text-[var(--wesal-muted)]">
              {location}
            </span>
          ) : null}
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.68rem] text-[var(--wesal-text)]">
            {hall.capacity != null && hall.capacity > 0 ? (
              <span>{t("common.peopleCount", { count: hall.capacity })}</span>
            ) : null}
            {priceLabel ? <span>{priceLabel}</span> : null}
            {pending ? (
              <span className="inline-flex items-center gap-1.5 text-[var(--wesal-muted)]">
                <i className="wesal-ai-spinner" aria-hidden="true" />
                {t("assistant.chat.recommend.opening")}
              </span>
            ) : (
              <span className={available ? "text-[#3f9d6d]" : "text-[var(--wesal-maroon)]"}>
                {availabilityLabel}
              </span>
            )}
          </span>
          {slotLabel ? (
            <span className="mt-1 block text-[0.68rem] leading-5 text-[var(--wesal-muted)]">
              {t("assistant.chat.recommend.requested")}: {slotLabel}
            </span>
          ) : null}
        </span>
      </button>
      {noticeKey || !canOpen ? (
        <p
          role="alert"
          className="mt-1.5 text-start text-[0.68rem] leading-5 text-[var(--wesal-maroon)]"
          data-testid="ai-chat-hall-notice"
        >
          {t(noticeKey || "assistant.chat.recommend.invalidHall")}
        </p>
      ) : null}
    </div>
  );
}
