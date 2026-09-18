"use client";

import { GoldStars } from "@/components/ui/GoldStar";
import { useT } from "@/i18n";
import type { HallReview } from "@/types/hall";

type HallCommentListProps = {
  comments: HallReview[];
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "و";
}

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
    <ul className="hall-comments-list divide-y divide-[#eee4dc]" data-testid="hall-comments-list">
      {comments.map((review) => (
        <li key={review.id} className="py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-pink)] text-xs font-extrabold text-[var(--wesal-maroon)]"
                aria-hidden="true"
              >
                {initials(review.author)}
              </span>
              <div className="min-w-0 text-start">
                <p className="truncate text-[15px] font-bold text-[var(--wesal-text)]">
                  {review.author}
                </p>
                {review.timeAgo ? (
                  <p className="text-xs text-[#b0a39c]">{review.timeAgo}</p>
                ) : null}
              </div>
            </div>
            {review.rating != null ? (
              <div className="shrink-0">
                <GoldStars rating={review.rating} size={13} />
              </div>
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
