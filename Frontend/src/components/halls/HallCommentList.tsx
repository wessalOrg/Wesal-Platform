"use client";

import { GoldStars } from "@/components/ui/GoldStar";
import { useT } from "@/i18n";
import type { HallReview } from "@/types/hall";

type HallCommentListProps = {
  comments: HallReview[];
};

export default function HallCommentList({ comments }: HallCommentListProps) {
  const t = useT();

  if (comments.length === 0) {
    return (
      <p
        className="mt-4 text-center text-sm leading-7 text-[#8a7a70]"
        data-testid="hall-comments-empty"
      >
        {t("halls.comment.empty")}
      </p>
    );
  }

  return (
    <ul
      className="mt-2 divide-y divide-[#eee4dc]"
      data-testid="hall-comments-list"
    >
      {comments.map((review) => (
        <li key={review.id} className="py-4">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div className="min-w-0 text-start">
              <p className="text-[15px] font-bold text-[var(--wesal-maroon)]">
                {review.author}
              </p>
              {review.rating != null ? (
                <div className="mt-1">
                  <GoldStars rating={review.rating} size={13} />
                </div>
              ) : null}
            </div>
            {review.timeAgo ? (
              <span className="shrink-0 text-sm text-[#b0a39c]">
                {review.timeAgo}
              </span>
            ) : null}
          </div>
          <p className="mt-2 whitespace-pre-line text-start text-[15px] leading-7 text-[#4a403c] break-words">
            {review.comment}
          </p>
        </li>
      ))}
    </ul>
  );
}
