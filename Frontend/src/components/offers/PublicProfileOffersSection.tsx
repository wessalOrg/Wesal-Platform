"use client";

import { useCallback, useEffect, useState } from "react";
import DiscoverOfferCard from "@/components/offers/DiscoverOfferCard";
import { useT } from "@/i18n";
import { useOfferLifecycle } from "@/hooks/useOfferLifecycle";
import { useRequestScope } from "@/hooks/useRequestScope";
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
  const scope = useRequestScope();
  const [loadedOffers, setOffers] = useState<ProfessionalOffer[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async (quiet = false) => {
    const current = scope.latest("offers");
    if (!current()) return;
    if (!quiet) setStatus("loading");
    try {
      const page = await fetchProfileProfessionalOffers(userId, 1, 20);
      if (!current()) return;
      setOffers(page.items);
      setStatus("ready");
    } catch { if (current()) setStatus("error"); }
  }, [scope, userId]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useOfferLifecycle(loadedOffers, { discoverUnloaded: true, onRevalidate: () => load(true) });
  const offers = loadedOffers.filter((offer) => isOfferPubliclyVisible(offer.startsAt, offer.endsAt, offer.stoppedAt));

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
    price: null,
    oldPrice: offer.oldPrice,
    offerPrice: offer.offerPrice,
    startsAt: offer.startsAt,
    endsAt: offer.endsAt,
    stoppedAt: offer.stoppedAt,
    createdAt: offer.createdAt ?? offer.startsAt,
  };
}
