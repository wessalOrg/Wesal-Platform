"use client";

import { useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthenticatedRequestScope } from "@/hooks/useAuthenticatedRequestScope";
import { useFavoritePostIds } from "@/hooks/useFavoritePostIds";
import { useT } from "@/i18n";
import { isUnauthorizedApiError } from "@/lib/api-error";

type PostFavoriteButtonProps = {
  postId: string;
  /** Kept for existing callers; public DTO hints never override the account-scoped API state. */
  initialSaved?: boolean | null;
  saveCount?: number;
  onChanged?: (saved: boolean, saveCount: number) => void;
  className?: string;
  variant?: "default" | "icon";
  testId?: string;
};

export default function PostFavoriteButton({
  postId, saveCount = 0, onChanged, className = "", variant = "default", testId = "post-favorite-button",
}: PostFavoriteButtonProps) {
  const t = useT(), router = useRouter();
  const { session } = useAuth();
  const { isCurrent } = useAuthenticatedRequestScope(session.isAuthenticated, postId);
  const favorites = useFavoritePostIds();
  const { rememberCount } = favorites;
  const errorId = useId();
  const saved = favorites.savedFor(postId);
  const busy = favorites.pending.has(postId);
  const loading = saved === null && favorites.loading;
  const error = favorites.errors.get(postId) ?? (saved === null ? favorites.errorKey : null);
  const count = favorites.counts.get(postId) ?? saveCount;
  useEffect(() => {
    if (variant !== "icon") rememberCount(postId, saveCount);
  }, [rememberCount, postId, saveCount, variant]);
  const loginPath = "/login?redirect=" + encodeURIComponent("/posts/" + encodeURIComponent(postId));

  async function toggle() {
    if (!session.isAuthenticated) { router.push(loginPath); return; }
    if (!isCurrent() || busy) return;
    if (saved === null) {
      if (favorites.requiresLogin) router.push(loginPath);
      else await favorites.refresh();
      return;
    }
    try {
      const changed = await favorites.setSaved(postId, !saved);
      if (changed && isCurrent()) onChanged?.(!saved, Math.max(0, count + (saved ? -1 : 1)));
    } catch (err) {
      if (isCurrent() && isUnauthorizedApiError(err)) router.push(loginPath);
      // The shared store rolls back and supplies localized, field-specific feedback.
    }
  }

  const label = !session.isAuthenticated ? "posts.favorite.add"
    : loading ? "posts.favorite.loading" : saved === null ? favorites.requiresLogin ? "posts.favorite.signIn" : "posts.favorite.check"
    : saved ? "posts.favorite.remove" : "posts.favorite.add";
  return (
    <span className="inline-flex max-w-full flex-col items-start gap-1">
      <button type="button"
        className={((variant === "icon"
          ? "inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-sm transition "
          : "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--wesal-border)] bg-white px-3 py-1.5 text-xs font-bold transition hover:border-[var(--wesal-maroon)] ")
          + (saved === true ? "text-[var(--wesal-maroon)]" : "text-[var(--wesal-muted)]") + " " + className).trim()}
        aria-pressed={saved ?? undefined} aria-label={t(label)} aria-busy={loading || busy}
        aria-describedby={error ? errorId : undefined}
        disabled={busy || (session.isAuthenticated && loading)}
        onClick={event => { event.preventDefault(); event.stopPropagation(); void toggle(); }}
        data-testid={testId} data-favorite-state={loading ? "loading" : saved === null ? "unknown" : saved ? "saved" : "unsaved"}>
        {loading ? <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity=".25" />
          <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg> : <HeartIcon filled={saved === true} />}
        {variant !== "icon" ? <span>{count > 0 ? count : t(saved === null && session.isAuthenticated ? label : "posts.favorite.label")}</span> : null}
      </button>
      {error ? <span id={errorId} role="alert" className="max-w-48 whitespace-normal break-words text-xs leading-5 text-[#b42318]">{t(error)}</span> : null}
    </span>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill={filled ? "currentColor" : "none"} aria-hidden="true">
      <path
        d="M12 19.2 5.4 12.8a3.8 3.8 0 0 1 5.4-5.4L12 8.6l1.2-1.2a3.8 3.8 0 0 1 5.4 5.4L12 19.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
