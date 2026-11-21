"use client";

import { useActiveHallOffer } from "@/hooks/useActiveHallOffer";
import { isOfferPubliclyVisible } from "@/lib/offer-status";
import { calculateOfferDiscountPercent } from "@/lib/offer-validation";
import { useT } from "@/i18n";

type HallActiveOfferBannerProps = {
  hallId: string;
};

function formatMoney(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "decimal",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return String(value);
  }
}

/** Public active hall offer from GET /halls/{id}/offers/active (backend-filtered). */
export default function HallActiveOfferBanner({
  hallId,
}: HallActiveOfferBannerProps) {
  const t = useT();
  const offer = useActiveHallOffer(hallId);
  const locale =
    typeof document !== "undefined" && document.documentElement.lang === "en"
      ? "en-GB"
      : "ar-EG";


  if (!offer || !isOfferPubliclyVisible(offer.startsAt, offer.endsAt, offer.stoppedAt)) return null;

  const discount = calculateOfferDiscountPercent(
    offer.oldBookingPrice,
    offer.offerPrice,
  );

  return (
    <aside
      className="rounded-2xl border border-[color-mix(in_srgb,var(--wesal-maroon)_18%,white)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--wesal-maroon)_12%,white),white)] p-4 text-start"
      data-testid="hall-active-offer"
      aria-label={t("halls.details.activeOffer.label")}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--wesal-maroon)]">
        {t("halls.details.activeOffer.label")}
      </p>
      <p className="mt-2 flex flex-wrap items-baseline gap-2 text-lg">
        <span className="font-extrabold text-[var(--wesal-maroon)]">
          {formatMoney(offer.offerPrice, locale)} {t("halls.details.activeOffer.currency")}
        </span>
        <span className="text-sm text-[var(--wesal-muted)] line-through">
          {formatMoney(offer.oldBookingPrice, locale)}{" "}
          {t("halls.details.activeOffer.currency")}
        </span>
        {discount != null ? (
          <span className="rounded-full bg-[var(--wesal-maroon)] px-2 py-0.5 text-xs font-semibold text-white">
            {t("halls.details.activeOffer.discount", { percent: String(discount) })}
          </span>
        ) : null}
      </p>
      <p className="mt-1 text-xs text-[var(--wesal-muted)]">
        {t("halls.details.activeOffer.hint")}
      </p>
    </aside>
  );
}
