"use client";

import DiscoverExploreCard from "@/components/discover/DiscoverExploreCard";
import DiscoverOfferCard from "@/components/offers/DiscoverOfferCard";
import { useT } from "@/i18n";
import type { DiscoverFilter, DiscoverItem } from "@/types/offers";

type DiscoverExploreGridProps = {
  filter: DiscoverFilter;
  items: DiscoverItem[];
  savedPostIds?: ReadonlySet<string>;
  onFavoriteChanged?: (postId: string, saved: boolean) => void;
};

export default function DiscoverExploreGrid({
  filter,
  items,
  savedPostIds,
  onFavoriteChanged,
}: DiscoverExploreGridProps) {
  const t = useT();

  if (items.length === 0) {
    return null;
  }

  if (filter === "Offers") {
    return (
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="discover-offers-grid"
      >
        {items.map((item, index) => (
          <DiscoverOfferCard
            key={`${item.contentType}-${item.id}`}
            item={item}
            index={index}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-label={t("discover.gridLabel")}
      data-testid="discover-explore-grid"
    >
      {items.map((item, index) =>
        item.contentType === "ProfessionalOffer" ||
        item.contentType === "HallOffer" ? (
          <DiscoverOfferCard
            key={`${item.contentType}-${item.id}`}
            item={item}
            index={index}
          />
        ) : (
          <DiscoverExploreCard
            key={`${item.contentType}-${item.id}`}
            item={item}
            index={index}
            initialSaved={Boolean(savedPostIds?.has(item.id))}
            onFavoriteChanged={onFavoriteChanged}
          />
        ),
      )}
    </div>
  );
}
