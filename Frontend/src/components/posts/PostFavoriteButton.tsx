"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useT } from "@/i18n";
import { isUnauthorizedApiError } from "@/lib/api-error";
import {
  addPostFavorite,
  removePostFavorite,
} from "@/services/post-interactions";

type PostFavoriteButtonProps = {
  postId: string;
  initialSaved?: boolean;
  saveCount?: number;
  onChanged?: (saved: boolean, saveCount: number) => void;
  className?: string;
};

export default function PostFavoriteButton({
  postId,
  initialSaved = false,
  saveCount = 0,
  onChanged,
  className = "",
}: PostFavoriteButtonProps) {
  const t = useT();
  const router = useRouter();
  const { session } = useAuth();
  const [saved, setSaved] = useState(initialSaved);
  const [count, setCount] = useState(saveCount);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSaved(initialSaved);
  }, [initialSaved, postId]);

  useEffect(() => {
    setCount(saveCount);
  }, [saveCount, postId]);

  async function toggle() {
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
    setCount((prev) => Math.max(0, prev + (next ? 1 : -1)));
    try {
      if (next) await addPostFavorite(postId);
      else await removePostFavorite(postId);
      onChanged?.(next, Math.max(0, count + (next ? 1 : -1)));
    } catch (err) {
      setSaved(!next);
      setCount(count);
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
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--wesal-border)] bg-white px-3 py-1.5 text-xs font-bold transition hover:border-[var(--wesal-maroon)] ${
        saved ? "text-[var(--wesal-maroon)]" : "text-[var(--wesal-muted)]"
      } ${className}`.trim()}
      aria-pressed={saved}
      aria-label={saved ? t("posts.favorite.remove") : t("posts.favorite.add")}
      disabled={busy}
      onClick={() => {
        void toggle();
      }}
      data-testid="post-favorite-button"
    >
      <HeartIcon filled={saved} />
      <span>{count > 0 ? count : t("posts.favorite.label")}</span>
    </button>
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
