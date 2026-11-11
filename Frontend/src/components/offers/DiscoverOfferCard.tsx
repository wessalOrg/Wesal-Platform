"use client";

import { useRouter } from "next/navigation";
import { useUiLang } from "@/components/layout/LanguageProvider";
import OfferPriceDisplay from "@/components/offers/OfferPriceDisplay";
import OfferStatusBadge from "@/components/offers/OfferStatusBadge";
import PostInquiryButton from "@/components/posts/PostInquiryButton";
import { useT } from "@/i18n";
import { buildHallDetailsPath } from "@/lib/booking-intent";
import { formatOfferDateRange } from "@/lib/offer-format";
import { resolveOfferStatus } from "@/lib/offer-status";
import type { DiscoverItem } from "@/types/offers";

type DiscoverOfferCardProps = {
  item: DiscoverItem;
  index?: number;
};

export default function DiscoverOfferCard({
  item,
  index = 0,
}: DiscoverOfferCardProps) {
  const t = useT();
  const lang = useUiLang();
  const router = useRouter();
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const status = resolveOfferStatus(item.startsAt, item.endsAt, item.stoppedAt);
  // 10.3 / 18 — public Discover only shows currently active offers.
  if (status !== "active") {
    return null;
  }
  const title =
    item.displayName?.trim() ||
    item.content?.trim() ||
    t("offers.card.untitled");
  const subtitle =
    item.contentType === "HallOffer"
      ? t("offers.card.hallOffer")
      : item.contentType === "ProfessionalOffer"
        ? t("offers.card.professionalOffer")
        : item.contentType;
  const dateRange = formatOfferDateRange(item.startsAt, item.endsAt, locale);

  function openDetails() {
    if (item.contentType === "HallOffer") {
      if (item.hallId?.trim()) {
        router.push(buildHallDetailsPath(item.hallId.trim()));
        return;
      }
      router.push(`/discover?filter=Offers&offer=${encodeURIComponent(item.id)}`);
      return;
    }
    if (item.contentType === "ProfessionalOffer" && item.ownerUserId) {
      router.push(`/professionals/${encodeURIComponent(item.ownerUserId)}`);
      return;
    }
    router.push(`/discover?filter=Offers&offer=${encodeURIComponent(item.id)}`);
  }

  return (
    <article
      id={`discover-offer-${item.id}`}
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-white shadow-[0_10px_28px_rgba(90,55,45,0.08)]"
      style={{ animationDelay: `${index * 60}ms` }}
      data-testid={`discover-offer-${item.id}`}
      data-offer-id={item.id}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--wesal-pink)]">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--wesal-muted)]">
            {t("offers.card.noImage")}
          </div>
        )}
        <span className="absolute end-3 top-3 rounded-md bg-[var(--wesal-maroon)] px-2 py-1 text-[0.65rem] font-bold text-white">
          {t("offers.card.badge")}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-extrabold text-[var(--wesal-maroon-dark)]">
          {title}
        </h3>
        <p className="text-xs text-[var(--wesal-muted)]">{subtitle}</p>
        <OfferPriceDisplay
          oldPrice={item.oldPrice}
          offerPrice={item.offerPrice}
          size="md"
        />
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <OfferStatusBadge status={status === "active" ? "active" : status} />
          {dateRange ? (
            <span className="inline-flex items-center gap-1 text-[0.7rem] text-[var(--wesal-muted)]">
              <CalendarIcon />
              {dateRange}
            </span>
          ) : null}
        </div>
        <div className="mt-auto flex flex-col gap-2 pt-3">
          <PostInquiryButton
            kind="offer"
            contentId={item.id}
            className="w-full"
            variant="outline"
          />
          <button
            type="button"
            className="btn-outline inline-flex min-h-11 w-full items-center justify-center gap-1 text-sm"
            onClick={openDetails}
            data-testid={`discover-offer-open-${item.id}`}
          >
            {t("offers.card.openDetails")}
          </button>
        </div>
      </div>
    </article>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
