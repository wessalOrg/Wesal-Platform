"use client";

import Link from "next/link";
import { useT } from "@/i18n";
import type { PostStatisticsItem } from "@/types/statistics";

type RecentPostViewsListProps = {
  posts: PostStatisticsItem[];
  locale: string;
  onViewAll?: () => void;
};

export default function RecentPostViewsList({
  posts,
  locale,
  onViewAll,
}: RecentPostViewsListProps) {
  const t = useT();
  const rows = [...posts]
    .sort((a, b) => b.viewCount - a.viewCount || b.saveCount - a.saveCount)
    .slice(0, 5);

  return (
    <section
      className="flex h-full flex-col rounded-[1.25rem] border border-[var(--wesal-border)] bg-white p-4 shadow-[0_0.5rem_1.5rem_rgba(90,55,45,0.05)] sm:p-5"
      data-testid="recent-post-views"
    >
      <h2 className="text-base font-extrabold text-[var(--wesal-text)]">
        {t("statistics.recent.title")}
      </h2>

      {rows.length === 0 ? (
        <p className="mt-6 text-center text-sm text-[var(--wesal-muted)]">
          {t("statistics.recent.empty")}
        </p>
      ) : (
        <ul className="mt-4 flex-1 space-y-2.5">
          {rows.map((post) => {
            const title =
              post.content?.trim() || t("statistics.recent.untitled");
            return (
              <li key={post.postId}>
                <Link
                  href={`/posts/${encodeURIComponent(post.postId)}`}
                  className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-[var(--wesal-pink-soft)]"
                  prefetch
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[color-mix(in_srgb,var(--wesal-maroon)_12%,white)] text-sm font-bold text-[var(--wesal-maroon-dark)]">
                    {(title.charAt(0) || "P").toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[var(--wesal-text)]">
                      {title}
                    </p>
                    <p className="text-xs text-[var(--wesal-muted)]">
                      {t("statistics.recent.views", {
                        count: new Intl.NumberFormat(locale).format(post.viewCount),
                      })}
                    </p>
                  </div>
                  <span
                    className="text-[var(--wesal-muted)]"
                    aria-hidden="true"
                  >
                    <EyeIcon />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {onViewAll ? (
        <button
          type="button"
          className="btn-outline mt-4 min-h-11 w-full text-sm"
          onClick={onViewAll}
        >
          {t("statistics.recent.viewAll")}
        </button>
      ) : null}
    </section>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
