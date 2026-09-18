"use client";

import { useEffect, useMemo, useState } from "react";
import HallCommentList from "@/components/halls/HallCommentList";
import HallCommentPanel from "@/components/halls/HallCommentPanel";
import HallGuestFeedbackPrompt from "@/components/halls/HallGuestFeedbackPrompt";
import HallRatingPanel from "@/components/halls/HallRatingPanel";
import { GoldStars } from "@/components/ui/GoldStar";
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
};

function estimateDistribution(average: number, total: number): number[] {
  if (total <= 0 || average <= 0) return [0, 0, 0, 0, 0];
  const weights = [0.08, 0.1, 0.12, 0.25, 0.45];
  const tilt = Math.min(1, Math.max(0, (average - 3) / 2));
  const skewed = [
    weights[0] * (1 - tilt),
    weights[1] * (1 - tilt * 0.6),
    weights[2],
    weights[3] * (0.7 + tilt * 0.5),
    weights[4] * (0.55 + tilt * 0.9),
  ];
  const sum = skewed.reduce((a, b) => a + b, 0) || 1;
  return skewed.map((weight) => Math.round((weight / sum) * total));
}

export default function HallReviewsSection({
  hallId,
  isHallOwner,
  rating,
  reviewCount,
  comments,
  onCommentSubmitted,
}: HallReviewsSectionProps) {
  const t = useT();
  const [summary, setSummary] = useState<{
    averageRating: number;
    totalRatings: number;
  } | null>(null);
  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchHallRatingSummary(hallId).then((result) => {
      if (!active || !result) return;
      setSummary({
        averageRating: result.averageRating,
        totalRatings: result.totalRatings,
      });
    });
    return () => {
      active = false;
    };
  }, [hallId]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setBarsReady(true));
    return () => window.cancelAnimationFrame(id);
  }, [hallId]);

  const average =
    summary?.averageRating ??
    (rating != null && Number.isFinite(rating) ? rating : 0);
  const total =
    summary?.totalRatings ??
    (reviewCount != null && Number.isFinite(reviewCount) ? reviewCount : 0);
  const bars = useMemo(() => estimateDistribution(average, total), [average, total]);

  return (
    <section
      aria-labelledby="hall-reviews-heading"
      className="hall-section-card hall-reviews-card"
      data-testid="hall-reviews-section"
    >
      <h2 id="hall-reviews-heading" className="hall-section-title">
        {t("halls.details.reviewsTitle")}
      </h2>

      <div className="hall-reviews-summary">
        <div className="hall-reviews-score">
          <p className="hall-reviews-score-value">
            {average > 0 ? average.toFixed(1) : "—"}
          </p>
          <div className="mt-1.5 flex justify-center sm:justify-start">
            <GoldStars rating={average || 0} size={15} />
          </div>
          <p className="mt-1 text-xs text-[var(--wesal-muted)]">
            {t("halls.details.basedOn", { count: total })}
          </p>
        </div>

        <ul className="hall-reviews-bars" aria-hidden={total <= 0}>
          {[5, 4, 3, 2, 1].map((star, index) => {
            const count = bars[star - 1] ?? 0;
            const pct = total > 0 ? Math.max(8, Math.round((count / total) * 100)) : 0;
            return (
              <li key={star} className="hall-reviews-bar-row">
                <span className="hall-reviews-bar-label">{star}</span>
                <span className="hall-reviews-bar-track">
                  <span
                    className="hall-reviews-bar-fill"
                    style={{
                      width: barsReady ? `${pct}%` : "0%",
                      transitionDelay: `${index * 60}ms`,
                    }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <HallCommentList comments={comments} />

      <div className="hall-add-review">
        <p className="hall-add-review-title">{t("halls.details.addReview")}</p>
        <HallRatingPanel
          hallId={hallId}
          isHallOwner={isHallOwner}
          embedded
          onRated={(result) => {
            setSummary({
              averageRating: result.averageRating,
              totalRatings: result.totalRatings,
            });
          }}
        />
        <HallCommentPanel
          hallId={hallId}
          isHallOwner={isHallOwner}
          embedded
          onSubmitted={onCommentSubmitted}
        />
        <HallGuestFeedbackPrompt hallId={hallId} isHallOwner={isHallOwner} />
      </div>
    </section>
  );
}
