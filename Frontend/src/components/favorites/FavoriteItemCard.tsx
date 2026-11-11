"use client";

import Link from "next/link";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { formatOfferDate } from "@/lib/offer-format";

export type FavoriteItemCardProps = {
  href: string;
  imageUrl: string | null;
  title: string;
  subtitle: string;
  description?: string | null;
  avatarUrl?: string | null;
  dateLabel?: string | null;
  viewLabel: string;
  onRemove: () => void;
  testId?: string;
};

export default function FavoriteItemCard({
  href,
  imageUrl,
  title,
  subtitle,
  description = null,
  avatarUrl = null,
  dateLabel = null,
  viewLabel,
  onRemove,
  testId,
}: FavoriteItemCardProps) {
  const t = useT();

  return (
    <article
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-white shadow-[0_10px_28px_rgba(90,55,45,0.07)]"
      data-testid={testId}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--wesal-pink)]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--wesal-muted)]">
            {t("posts.textOnly")}
          </div>
        )}
        <span
          className="absolute start-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--wesal-maroon)] text-white shadow-sm"
          aria-hidden="true"
        >
          <HeartIcon filled />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-1 text-sm font-extrabold text-[var(--wesal-maroon-dark)]">
              {title}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-[var(--wesal-muted)]">
              {subtitle}
            </p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--wesal-pink)] text-xs font-bold text-[var(--wesal-maroon)]">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              title.charAt(0).toUpperCase()
            )}
          </div>
        </div>

        {description ? (
          <p className="line-clamp-2 text-xs leading-5 text-[var(--wesal-muted)]">
            {description}
          </p>
        ) : null}

        {dateLabel ? (
          <p className="inline-flex items-center gap-1 text-[0.7rem] text-[var(--wesal-muted)]">
            <CalendarIcon />
            {dateLabel}
          </p>
        ) : null}

        <div className="mt-auto grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
          <Link
            href={href}
            className="btn-primary inline-flex min-h-10 items-center justify-center gap-1.5 px-3 text-xs"
          >
            {viewLabel}
            <span aria-hidden="true">←</span>
          </Link>
          <button
            type="button"
            className="btn-outline inline-flex min-h-10 items-center justify-center gap-1.5 px-3 text-xs"
            onClick={onRemove}
          >
            <TrashIcon />
            {t("seeker.favorites.remove")}
          </button>
        </div>
      </div>
    </article>
  );
}

export function useFavoriteDateLabel(iso: string | null | undefined): string {
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  return formatOfferDate(iso, locale);
}

function HeartIcon({ filled }: { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill={filled ? "currentColor" : "none"}
      aria-hidden="true"
    >
      <path
        d="M12 19.2 5.4 12.8a3.8 3.8 0 0 1 5.4-5.4L12 8.6l1.2-1.2a3.8 3.8 0 0 1 5.4 5.4L12 19.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 3.5v3M16 3.5v3M4 9.5h16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="M5 7h14M10 7V5h4v2M8 7v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
