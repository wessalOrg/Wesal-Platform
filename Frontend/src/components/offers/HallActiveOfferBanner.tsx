"use client";

import { useEffect, useState } from "react";
import OfferPriceDisplay from "@/components/offers/OfferPriceDisplay";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { formatOfferDateRange } from "@/lib/offer-format";
import {
  isOfferPubliclyVisible,
  offerDiscountPercent,
} from "@/lib/offer-status";
import { fetchActiveHallOffer } from "@/services/hall-offers";
import type { HallOffer } from "@/types/offers";

type HallActiveOfferBannerProps = {
  hallId: string;
  className?: string;
};

export default function HallActiveOfferBanner({
  hallId,
  className = "",
}: HallActiveOfferBannerProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const [offer, setOffer] = useState<HallOffer | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchActiveHallOffer(hallId)
      .then((row) => {
        if (!cancelled) setOffer(row);
      })
      .catch(() => {
        if (!cancelled) setOffer(null);
      });
    return () => {
      cancelled = true;
    };
  }, [hallId]);

  if (
    !offer ||
    !isOfferPubliclyVisible(offer.startsAt, offer.endsAt, offer.stoppedAt)
  ) {
    return null;
  }

  const discount = offerDiscountPercent(offer.oldBookingPrice, offer.offerPrice);
  const dates = formatOfferDateRange(offer.startsAt, offer.endsAt, locale);

  return (
    <aside
      className={`rounded-2xl border border-[color-mix(in_srgb,var(--wesal-maroon)_28%,var(--wesal-border))] bg-[color-mix(in_srgb,var(--wesal-maroon)_8%,white)] p-4 ${className}`.trim()}
      data-testid="hall-active-offer-banner"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--wesal-maroon)]">
            {t("offers.hall.bannerTitle")}
          </p>
          {discount != null ? (
            <p className="mt-1 text-sm font-extrabold text-[var(--wesal-maroon-dark)]">
              {t("offers.discount", { percent: discount })}
            </p>
          ) : null}
          {dates ? (
            <p className="mt-1 text-xs text-[var(--wesal-muted)]">{dates}</p>
          ) : null}
        </div>
        <OfferPriceDisplay
          oldPrice={offer.oldBookingPrice}
          offerPrice={offer.offerPrice}
          size="lg"
        />
      </div>
    </aside>
  );
}
