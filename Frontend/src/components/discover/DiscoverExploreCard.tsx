"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useT } from "@/i18n";
import { isUnauthorizedApiError } from "@/lib/api-error";
import { discoverItemHref } from "@/lib/discover-filter";
import {
  hydrateSavedHallsFromServer,
  isHallSaved,
  subscribeSavedHalls,
  toggleSavedHall,
} from "@/lib/saved-halls";
import {
  addPostFavorite,
  removePostFavorite,
} from "@/services/post-interactions";
import type { DiscoverItem } from "@/types/offers";

type DiscoverExploreCardProps = {
  item: DiscoverItem;
  index?: number;
  initialSaved?: boolean;
  onFavoriteChanged?: (postId: string, saved: boolean) => void;
};

export default function DiscoverExploreCard({
  item,
  index = 0,
  initialSaved = false,
  onFavoriteChanged,
}: DiscoverExploreCardProps) {
  const t = useT();
  const href = discoverItemHref(item);
  const title =
    item.displayName?.trim() ||
    item.content?.trim() ||
    t("offers.card.untitled");
  const isPost = item.contentType === "Post";
  const isHall = item.contentType === "Hall";

  return (
    <article
      className="group overflow-hidden rounded-[1.15rem] border border-[var(--wesal-border)] bg-white shadow-[0_0.65rem_1.5rem_rgba(90,55,45,0.07)] transition hover:shadow-[0_1rem_2rem_rgba(90,55,45,0.12)]"
      style={{ animationDelay: `${index * 40}ms` }}
      data-testid={`discover-card-${item.id}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[color-mix(in_srgb,var(--wesal-maroon)_10%,white)]">
        {href ? (
          <Link href={href} className="absolute inset-0" prefetch aria-label={title}>
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt=""
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-extrabold text-[var(--wesal-maroon)]">
                {(title.charAt(0) || "?").toUpperCase()}
              </span>
            )}
          </Link>
        ) : item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl font-extrabold text-[var(--wesal-maroon)]">
            {(title.charAt(0) || "?").toUpperCase()}
          </div>
        )}

        <div className="absolute end-2.5 top-2.5 z-10">
          {isPost ? (
            <PostHeartButton
              postId={item.id}
              initialSaved={initialSaved}
              onChanged={onFavoriteChanged}
            />
          ) : isHall ? (
            <HallHeartButton hallId={item.id} />
          ) : null}
        </div>
      </div>

      {href ? (
        <Link
          href={href}
          className="flex items-center gap-2 p-3.5"
          prefetch
        >
          <CardFooter
            title={title}
            location={item.location}
            contentType={item.contentType}
            showRating={isHall}
          />
        </Link>
      ) : (
        <div className="flex items-center gap-2 p-3.5">
          <CardFooter
            title={title}
            location={item.location}
            contentType={item.contentType}
            showRating={isHall}
          />
        </div>
      )}
    </article>
  );
}

function CardFooter({
  title,
  location,
  contentType,
  showRating,
}: {
  title: string;
  location: string | null;
  contentType: string;
  showRating: boolean;
}) {
  const t = useT();
  return (
    <>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-extrabold text-[var(--wesal-maroon-dark)]">
          {title}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--wesal-muted)]">
          {location ? (
            <span className="inline-flex items-center gap-1 truncate">
              <PinIcon />
              {location}
            </span>
          ) : (
            <span className="truncate">{discoverTypeLabel(contentType, t)}</span>
          )}
          {showRating ? (
            <span className="inline-flex items-center gap-1 font-semibold text-[#c9a227]">
              <StarIcon />
              —
            </span>
          ) : null}
        </div>
      </div>
      <span
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-maroon)] text-white"
        aria-hidden="true"
      >
        <ChevronIcon />
      </span>
    </>
  );
}

function PostHeartButton({
  postId,
  initialSaved = false,
  onChanged,
}: {
  postId: string;
  initialSaved?: boolean;
  onChanged?: (postId: string, saved: boolean) => void;
}) {
  const t = useT();
  const router = useRouter();
  const { session } = useAuth();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSaved(initialSaved);
  }, [initialSaved, postId]);

  async function toggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    if (!session.isAuthenticated) {
      router.push(
        `/login?redirect=${encodeURIComponent(`/posts/${encodeURIComponent(postId)}`)}`,
      );
      return;
    }
    const next = !saved;
    setBusy(true);
    setSaved(next);
    onChanged?.(postId, next);
    try {
      if (next) await addPostFavorite(postId);
      else await removePostFavorite(postId);
    } catch (err) {
      setSaved(!next);
      onChanged?.(postId, !next);
      if (isUnauthorizedApiError(err)) {
        router.push(
          `/login?redirect=${encodeURIComponent(`/posts/${encodeURIComponent(postId)}`)}`,
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-sm transition ${
        saved ? "text-[var(--wesal-maroon)]" : "text-[var(--wesal-muted)]"
      }`}
      aria-pressed={saved}
      aria-label={saved ? t("posts.favorite.remove") : t("posts.favorite.add")}
      disabled={busy}
      onClick={(event) => {
        void toggle(event);
      }}
      data-testid={`discover-favorite-${postId}`}
    >
      <HeartIcon filled={saved} />
    </button>
  );
}

function HallHeartButton({ hallId }: { hallId: string }) {
  const t = useT();
  const router = useRouter();
  const { session } = useAuth();
  const saved = useSyncExternalStore(
    subscribeSavedHalls,
    () => isHallSaved(hallId),
    () => false,
  );

  useEffect(() => {
    void hydrateSavedHallsFromServer();
  }, []);

  function toggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!session.isAuthenticated) {
      router.push(
        `/login?redirect=${encodeURIComponent(`/halls/${encodeURIComponent(hallId)}`)}`,
      );
      return;
    }
    toggleSavedHall(hallId);
  }

  return (
    <button
      type="button"
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-sm transition ${
        saved ? "text-[var(--wesal-maroon)]" : "text-[var(--wesal-muted)]"
      }`}
      aria-pressed={saved}
      aria-label={saved ? t("halls.details.saved") : t("halls.catalog.favorite")}
      onClick={toggle}
      data-testid={`discover-hall-favorite-${hallId}`}
    >
      <HeartIcon filled={saved} />
    </button>
  );
}

function discoverTypeLabel(
  contentType: string,
  t: (key: string) => string,
): string {
  const key = `discover.type.${contentType}`;
  const label = t(key);
  return label === key ? contentType : label;
}

function HeartIcon({ filled }: { filled: boolean }) {
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

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden="true">
      <path
        d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden="true">
      <path d="m12 3.5 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.8 7.2 18.4l.9-5.4L4.2 9.2l5.4-.8L12 3.5Z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 rtl:rotate-180" aria-hidden="true">
      <path
        d="M10 7l5 5-5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
