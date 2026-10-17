"use client";

import { useEffect, useState } from "react";
import HallAddReviewCard from "@/components/halls/HallAddReviewCard";
import HallCommentList from "@/components/halls/HallCommentList";
import { GoldStar, GoldStars } from "@/components/ui/GoldStar";
import { useT } from "@/i18n";
import { fetchHallRatingSummary } from "@/services/ratings";
import type { HallReview } from "@/types/hall";

type HallReviewsSectionProps = {
  hallId: string;
  isHallOwner: boolean;
  rating?: number | null;
  reviewCount?: number | null;
  comments: HallReview[];
  onCommentSubmitted: (review: HallReview) => void;
  onCommentUpdated: (review: HallReview) => void;
  onCommentDeleted: (commentId: string) => void;
};

export default function HallReviewsSection({
  hallId,
  isHallOwner,
  rating,
  reviewCount,
  comments,
  onCommentSubmitted,
  onCommentUpdated,
  onCommentDeleted,
}: HallReviewsSectionProps) {
  const t = useT();
  const [summary, setSummary] = useState<{
    averageRating: number;
    totalRatings: number;
  } | null>(null);
  const [viewerRating, setViewerRating] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void fetchHallRatingSummary(hallId).then((result) => {
      if (!active || !result) return;
      setSummary({
        averageRating: result.averageRating,
        totalRatings: result.totalRatings,
      });
      setViewerRating(result.userRating);
    });
    return () => {
      active = false;
    };
  }, [hallId]);

  const average =
    summary?.averageRating ??
    (rating != null && Number.isFinite(rating) ? rating : 0);
  const total =
    summary?.totalRatings ??
    (reviewCount != null && Number.isFinite(reviewCount) ? reviewCount : 0);

  return (
    <section
      id="hall-reviews"
      aria-labelledby="hall-reviews-heading"
      className="hall-section-card hall-reviews-card scroll-mt-28"
      data-testid="hall-reviews-section"
    >
      <h2 id="hall-reviews-heading" className="hall-reviews-heading">
        <GoldStar size={18} />
        <span className="hall-reviews-heading-text">{t("halls.details.reviewsTitle")}</span>
      </h2>

      <div className="hall-reviews-summary">
        <div className="hall-reviews-score">
          <p className="hall-reviews-score-value">{average > 0 ? average.toFixed(1) : "0.0"}</p>
          <p className="hall-reviews-out-of">{t("halls.details.outOfFive")}</p>
        </div>
        <span className="hall-reviews-divider" aria-hidden="true" />
        <div className="hall-reviews-stars">
          <GoldStars rating={average || 0} size={16} />
          <p className="hall-reviews-based">{t("halls.details.basedOn", { count: total })}</p>
        </div>
      </div>

      <HallCommentList
        hallId={hallId}
        comments={comments}
        viewerRating={viewerRating}
        onCommentUpdated={onCommentUpdated}
        onCommentDeleted={onCommentDeleted}
      />

      <HallAddReviewCard
        hallId={hallId}
        isHallOwner={isHallOwner}
        onRated={(result) => {
          setSummary({
            averageRating: result.averageRating,
            totalRatings: result.totalRatings,
          });
          setViewerRating(result.value);
        }}
        onCommentSubmitted={onCommentSubmitted}
      />
    </section>
  );
}
