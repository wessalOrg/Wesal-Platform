"use client";

import { useEffect, useState } from "react";
import DiscoverOfferCard from "@/components/offers/DiscoverOfferCard";
import { useT } from "@/i18n";
import { ApiError } from "@/lib/api-error";
import { isOfferPubliclyVisible } from "@/lib/offer-status";
import { fetchProfileProfessionalOffers } from "@/services/professional-offers";
import type { DiscoverItem, ProfessionalOffer } from "@/types/offers";

type PublicProfileOffersSectionProps = {
  userId: string;
  className?: string;
};

/**
 * Active professional offers for a public profile (GET /offers/profile/{userId}).
 * Expired / stopped offers are omitted by the API; client also filters as a guard.
 */
export default function PublicProfileOffersSection({
  userId,
  className = "",
}: PublicProfileOffersSectionProps) {
  const t = useT();
  const [offers, setOffers] = useState<ProfessionalOffer[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    void fetchProfileProfessionalOffers(userId, 1, 20)
      .then((page) => {
        if (cancelled) return;
        setOffers(
          page.items.filter((offer) =>
            isOfferPubliclyVisible(offer.startsAt, offer.endsAt, offer.stoppedAt),
          ),
        );
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        if (!(err instanceof ApiError)) {
          /* keep empty */
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (status === "loading") {
    return (
      <p className={`text-sm text-[var(--wesal-muted)] ${className}`.trim()}>
        {t("offers.loading")}
      </p>
    );
  }

  if (status === "ready" && offers.length === 0) {
    return null;
  }

  return (
    <section className={`space-y-3 ${className}`.trim()} data-testid="public-profile-offers">
      <h2 className="text-lg font-extrabold text-[var(--wesal-maroon-dark)]">
        {t("offers.pro.title")}
      </h2>
      {status === "error" ? (
        <p className="text-sm text-[#b42318]">{t("offers.errors.loadFailed")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer, index) => (
            <DiscoverOfferCard
              key={offer.id}
              index={index}
              item={toDiscoverItem(offer)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function toDiscoverItem(offer: ProfessionalOffer): DiscoverItem {
  return {
    contentType: "ProfessionalOffer",
    id: offer.id,
    hallId: null,
    ownerUserId: offer.ownerUserId,
    displayName: offer.content,
    content: offer.content,
    imageUrl: offer.images[0]?.url ?? null,
    location: null,
    price: offer.priceBox,
    oldPrice: offer.oldPrice,
    offerPrice: offer.offerPrice,
    startsAt: offer.startsAt,
    endsAt: offer.endsAt,
    stoppedAt: offer.stoppedAt,
    createdAt: offer.createdAt ?? offer.startsAt,
  };
}
