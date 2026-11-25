"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import MabroukFigure from "@/components/brand/MabroukFigure";
import FavoriteItemCard, {
  useFavoriteDateLabel,
} from "@/components/favorites/FavoriteItemCard";
import RemoveFavoriteConfirmDialog from "@/components/favorites/RemoveFavoriteConfirmDialog";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { buildHallDetailsPath } from "@/lib/booking-intent";
import { localizeHallName, localizeLocation } from "@/lib/localize-hall-display";
import {
  getServerSavedHallIds,
  hydrateSavedHallsFromServer,
  readSavedHallIds,
  removeSavedHall,
  subscribeSavedHalls,
} from "@/lib/saved-halls";
import { fetchHallById } from "@/services/halls";
import {
  fetchFavoritePosts,
} from "@/services/post-interactions";
import type { HallDetails } from "@/types/hall";
import { useAuthenticatedRequestScope } from "@/hooks/useAuthenticatedRequestScope";
import { useFavoritePostIds } from "@/hooks/useFavoritePostIds";
import { useContentPagination } from "@/hooks/useContentPagination";
import ContentPagination from "@/components/ui/ContentPagination";
import type { FavoritePost } from "@/types/posts";

/** Section 12 — saved halls + saved posts only (no offer/role favorites API). */
type FavoriteFilter = "all" | "halls" | "posts";

type HallRow =
  | { id: string; status: "ready"; hall: HallDetails }
  | { id: string; status: "missing" };

type PendingRemove =
  | { kind: "hall"; id: string; name: string }
  | { kind: "post"; id: string; name: string };

const FILTERS: FavoriteFilter[] = ["all", "halls", "posts"];

export default function SeekerFavoritesPage() {
  const t = useT();
  const lang = useUiLang();
  const { session } = useAuth();
  const { account, scope, isCurrent } = useAuthenticatedRequestScope(session.isAuthenticated);
  const { savedFor, setSaved, captureRead, observePage, revision } = useFavoritePostIds({ hydrate: false });
  const fetchPosts = useCallback(async (page: number, size: number) => {
    if (!isCurrent()) throw new Error("Obsolete favorites request");
    const read = captureRead();
    const result = await fetchFavoritePosts(page, size);
    if (!isCurrent()) throw new Error("Obsolete favorites response");
    observePage(result, read);
    return result;
  }, [isCurrent, captureRead, observePage]);
  const pagination = useContentPagination({ context: scope, enabled: Boolean(account) && session.isAuthenticated, pageSize: 50, fetchPage: fetchPosts });
  const posts = pagination.items.filter(post => savedFor(post.id) !== false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const lastRevision = useRef({ scope, revision });
  const refreshPosts = pagination.refresh;
  useEffect(() => {
    const previous = lastRevision.current;
    lastRevision.current = { scope, revision };
    if (previous.scope === scope && previous.revision !== revision) void refreshPosts();
  }, [scope, revision, refreshPosts]);
  const postsLoading = pagination.busy;
  const savedIds = useSyncExternalStore(
    subscribeSavedHalls,
    readSavedHallIds,
    getServerSavedHallIds,
  );
  const [filter, setFilter] = useState<FavoriteFilter>("all");
  const [hallRows, setHallRows] = useState<HallRow[]>([]);
  const [hallsLoading, setHallsLoading] = useState(savedIds.length > 0);
  const [pending, setPending] = useState<PendingRemove | null>(null);
  const [removing, setRemoving] = useState(false);
  const idsKey = savedIds.join("\0");
  const [seenIdsKey, setSeenIdsKey] = useState(idsKey);
  if (seenIdsKey !== idsKey) {
    setSeenIdsKey(idsKey);
    setHallsLoading(Boolean(idsKey));
    if (!idsKey) setHallRows([]);
  }
  const [previousScope, setPreviousScope] = useState(scope);
  if (previousScope !== scope) {
    setPreviousScope(scope); setHallRows([]); setHallsLoading(savedIds.length > 0);
    setPending(null); setRemoving(false); setRemoveError(null);
  }

  useEffect(() => { void hydrateSavedHallsFromServer(); }, [account]);

  useEffect(() => {
    const ids = idsKey ? idsKey.split("\0") : [];
    if (ids.length === 0) {
      return;
    }
    let active = true;
    void Promise.all(
      [...ids].reverse().map(async (id): Promise<HallRow> => {
        const result = await fetchHallById(id);
        return result.status === "ok"
          ? { id, status: "ready", hall: result.hall }
          : { id, status: "missing" };
      }),
    ).then((next) => {
      if (!active || !isCurrent()) return;
      setHallRows(next);
      setHallsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [idsKey, isCurrent]);

  const visibleHalls = useMemo(
    () => hallRows.filter((row) => savedIds.includes(row.id) && row.status === "ready"),
    [hallRows, savedIds],
  );

  const showHalls = filter === "all" || filter === "halls";
  const showPosts = filter === "all" || filter === "posts";
  const loading = hallsLoading || postsLoading;
  const hasContent =
    (showHalls && visibleHalls.length > 0) || (showPosts && posts.length > 0);
  const isEmpty = !loading && !hasContent && !pagination.error;

  async function confirmRemove() {
    if (!pending || !isCurrent()) return;
    const captured = scope.capture();
    const active = () => captured() && isCurrent();
    setRemoveError(null);
    setRemoving(true);
    const current = pending;
    setPending(null);
    try {
      if (current.kind === "hall") {
        removeSavedHall(current.id);
      } else {
        await setSaved(current.id, false);
      }
    } catch {
      if (active() && current.kind === "post") {
        setRemoveError("posts.favorites.errors.removeFailed");
      }
    } finally {
      if (active()) setRemoving(false);
    }
  }

  return (
    <div data-testid="seeker-favorites-page" className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[var(--wesal-maroon)]">
            <HeartIcon />
            {t("seeker.nav.favorites")}
          </h1>
          <p className="mt-1 text-sm text-[var(--wesal-muted)]">
            {t("seeker.favoritesSubtitle")}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("seeker.nav.favorites")}>
        {FILTERS.map((key) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                active
                  ? "bg-[var(--wesal-maroon)] text-white shadow-[0_6px_16px_rgba(193,123,127,0.28)]"
                  : "bg-white text-[var(--wesal-muted)] ring-1 ring-[var(--wesal-border)] hover:text-[var(--wesal-maroon)]"
              }`}
              onClick={() => setFilter(key)}
            >
              {t(`seeker.favorites.filter.${key}`)}
            </button>
          );
        })}
      </div>

      {loading && !hasContent ? (
        <div
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          aria-busy="true"
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-72 animate-pulse rounded-2xl bg-white/80"
            />
          ))}
        </div>
      ) : null}

      {isEmpty ? (
        <FavoritesEmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {showHalls
            ? visibleHalls.map((row) => {
                if (row.status !== "ready") return null;
                const name = localizeHallName(row.hall.id, row.hall.name, lang);
                return (
                  <FavoriteHallCardBridge
                    key={`hall-${row.id}`}
                    hall={row.hall}
                    name={name}
                    onAskRemove={() =>
                      setPending({ kind: "hall", id: row.id, name })
                    }
                  />
                );
              })
            : null}

          {showPosts
            ? posts.map((post) => (
                <FavoritePostCardBridge
                  key={`post-${post.id}`}
                  post={post}
                  onAskRemove={() =>
                    setPending({
                      kind: "post",
                      id: post.id,
                      name: post.content?.trim() || t("posts.untitled"),
                    })
                  }
                />
              ))
            : null}
        </div>
      )}

      {removeError ? <p role="alert" className="text-sm text-[#b42318]">{t(removeError)}</p> : null}
      {showPosts ? <ContentPagination {...pagination} onMore={() => void pagination.loadMore()} onRetry={() => void pagination.refresh()} /> : null}

      <RemoveFavoriteConfirmDialog
        open={Boolean(pending)}
        busy={removing}
        title={
          pending?.kind === "hall"
            ? t("seeker.favorites.confirmHallTitle")
            : t("seeker.favorites.confirmPostTitle")
        }
        body={
          pending?.kind === "hall"
            ? t("seeker.favorites.confirmHallBody")
            : t("seeker.favorites.confirmPostBody")
        }
        onClose={() => {
          if (!removing) setPending(null);
        }}
        onConfirm={() => {
          void confirmRemove();
        }}
      />
    </div>
  );
}

function FavoriteHallCardBridge({
  hall,
  name,
  onAskRemove,
}: {
  hall: HallDetails;
  name: string;
  onAskRemove: () => void;
}) {
  const t = useT();
  const lang = useUiLang();
  const location = localizeLocation(hall.location, lang);
  return (
    <FavoriteItemCard
      href={buildHallDetailsPath(hall.id)}
      imageUrl={hall.images[0] ?? null}
      title={name}
      subtitle={t("seeker.favorites.filter.halls")}
      description={location}
      viewLabel={t("seeker.favorites.viewHall")}
      onRemove={onAskRemove}
      testId={`seeker-favorite-hall-${hall.id}`}
    />
  );
}

function FavoritePostCardBridge({
  post,
  onAskRemove,
}: {
  post: FavoritePost;
  onAskRemove: () => void;
}) {
  const t = useT();
  const dateLabel = useFavoriteDateLabel(post.savedAt);
  return (
    <FavoriteItemCard
      href={`/posts/${encodeURIComponent(post.id)}`}
      imageUrl={post.images[0]?.url ?? null}
      title={post.content?.trim() || t("posts.untitled")}
      subtitle={post.ownerName || t("posts.profile.untitled")}
      description={post.content}
      avatarUrl={post.ownerAvatarUrl}
      dateLabel={dateLabel}
      viewLabel={t("seeker.favorites.viewPost")}
      onRemove={onAskRemove}
      testId={`seeker-favorite-post-${post.id}`}
    />
  );
}

function FavoritesEmptyState() {
  const t = useT();
  return (
    <div
      className="flex flex-col items-center gap-6 rounded-3xl border border-[var(--wesal-border)] bg-white px-5 py-10 text-center shadow-[0_12px_32px_rgba(90,55,45,0.06)] sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:text-start"
      data-testid="seeker-favorites-empty"
    >
      <div className="order-2 min-w-0 flex-1 sm:order-1">
        <p className="text-lg font-extrabold text-[var(--wesal-maroon-dark)] sm:text-xl">
          {t("seeker.favoritesEmpty")}
        </p>
        <p className="mt-2 max-w-md text-sm leading-7 text-[var(--wesal-muted)]">
          {t("seeker.favoritesEmptyHint")}
        </p>
        <Link
          href="/discover"
          className="btn-primary mt-5 inline-flex min-h-11 items-center gap-2 px-5"
          prefetch
        >
          {t("seeker.favorites.discoverCta")}
          <span aria-hidden="true">←</span>
        </Link>
      </div>
      <div className="order-1 shrink-0 sm:order-2" aria-hidden="true">
        {/* Mabrouk pointing at empty-favorite heart box — replaces prior rhombus/heart glyph */}
        <MabroukFigure
          pose="favoritesEmpty"
          size="lg"
          rounded="2xl"
          className="!h-40 !w-[11rem] bg-transparent shadow-[0_0.75rem_1.75rem_rgba(90,55,45,0.1)] sm:!h-44 sm:!w-[12.5rem]"
        />
      </div>
    </div>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
      <path d="M12 19.2 5.4 12.8a3.8 3.8 0 0 1 5.4-5.4L12 8.6l1.2-1.2a3.8 3.8 0 0 1 5.4 5.4L12 19.2Z" />
    </svg>
  );
}
