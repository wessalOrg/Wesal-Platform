"use client";

import HallCommentPanel from "@/components/halls/HallCommentPanel";
import HallGuestFeedbackPrompt from "@/components/halls/HallGuestFeedbackPrompt";
import HallRatingPanel from "@/components/halls/HallRatingPanel";
import { useHallPermissions } from "@/hooks/useHallPermissions";
import { useT } from "@/i18n";
import type { HallReview } from "@/types/hall";

type HallAddReviewCardProps = {
  hallId: string;
  isHallOwner: boolean;
  onRated?: (result: {
    averageRating: number;
    totalRatings: number;
    value: number;
    created: boolean;
  }) => void;
  onCommentSubmitted?: (review: HallReview) => void;
};

export default function HallAddReviewCard({
  hallId,
  isHallOwner,
  onRated,
  onCommentSubmitted,
}: HallAddReviewCardProps) {
  const t = useT();
  const { authReady, canRate, canComment, isGuest, isOwnHall } = useHallPermissions({
    isOwner: isHallOwner,
  });
  if (authReady && isGuest && !isOwnHall) {
    return <HallGuestFeedbackPrompt hallId={hallId} isHallOwner={isHallOwner} />;
  }

  const showForm = authReady && (canRate || canComment);

  if (!showForm) return null;

  return (
    <div className="hall-add-review" data-testid="hall-add-review">
      <div className="hall-add-review-head">
        <span className="hall-add-review-badge" aria-hidden="true">
          <ReviewBadgeStar />
        </span>
        <p className="hall-add-review-title">{t("halls.details.addReview")}</p>
      </div>
      <p className="hall-add-review-hint">{t("halls.details.addReviewHint")}</p>
      <HallRatingPanel
        hallId={hallId}
        isHallOwner={isHallOwner}
        embedded
        onRated={onRated}
      />
      <HallCommentPanel
        hallId={hallId}
        isHallOwner={isHallOwner}
        embedded
        onSubmitted={onCommentSubmitted}
      />
    </div>
  );
}

function ReviewBadgeStar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.4l2.15 4.36 4.81.7-3.48 3.39.82 4.79L12 14.4l-4.3 2.26.82-4.79-3.48-3.39 4.81-.7L12 3.4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
