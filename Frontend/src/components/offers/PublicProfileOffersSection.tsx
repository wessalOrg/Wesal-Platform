"use client";

import { useCallback } from "react";
import ContentPagination from "@/components/ui/ContentPagination";
import { useContentPagination } from "@/hooks/useContentPagination";
import DiscoverOfferCard from "@/components/offers/DiscoverOfferCard";
import { useT } from "@/i18n";
import { useOfferLifecycle } from "@/hooks/useOfferLifecycle";
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
export default function PublicProfileOffersSection(props: PublicProfileOffersSectionProps) {
  return <ProfileOffers key={props.userId} {...props} />;
}

function ProfileOffers({
  userId,
  className = "",
}: PublicProfileOffersSectionProps) {
  const t = useT();
  const fetchPage = useCallback((page: number, size: number) => fetchProfileProfessionalOffers(userId, page, size), [userId]);
  const pagination = useContentPagination({ context: userId, pageSize: 20, fetchPage });
  const loadedOffers = pagination.items;
  const status = pagination.loaded ? "ready" : pagination.error ? "error" : "loading";
  const load = pagination.refresh;
  useOfferLifecycle(loadedOffers, { discoverUnloaded: true, onRevalidate: () => load() });
  const offers = loadedOffers.filter((offer) => isOfferPubliclyVisible(offer.startsAt, offer.endsAt, offer.stoppedAt));

  if (status === "loading") {
    return (
      <p className={`text-sm text-[var(--wesal-muted)] ${className}`.trim()}>
        {t("offers.loading")}
      </p>
    );
  }

  if (status === "ready" && offers.length === 0 && !pagination.hasMore && !pagination.error) {
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
      <ContentPagination {...pagination} onMore={() => void pagination.loadMore()}
        onRetry={() => void pagination.refresh()} />
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
    price: null,
    oldPrice: offer.oldPrice,
    offerPrice: offer.offerPrice,
    startsAt: offer.startsAt,
    endsAt: offer.endsAt,
    stoppedAt: offer.stoppedAt,
    createdAt: offer.createdAt ?? offer.startsAt,
  };
}
