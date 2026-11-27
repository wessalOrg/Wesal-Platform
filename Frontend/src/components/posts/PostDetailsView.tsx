"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import ContentImageGallery from "@/components/posts/ContentImageGallery";
import PostActionsMenu from "@/components/posts/PostActionsMenu";
import PostCommentSection from "@/components/posts/PostCommentSection";
import PostFavoriteButton from "@/components/posts/PostFavoriteButton";
import PostShareButton from "@/components/posts/PostShareButton";
import SuccessToast from "@/components/ui/SuccessToast";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { PROFESSIONAL_PUBLIC_PATH } from "@/lib/account-profile-path";
import { ApiError } from "@/lib/api-error";
import { formatOfferAmount } from "@/lib/offer-format";
import { formatRelativeTime } from "@/lib/relative-time";
import { fetchPost } from "@/services/posts";
import { fetchPublicProfessionalProfile } from "@/services/public-profile";
import type { Post } from "@/types/posts";

type PostDetailsViewProps = {
  postId: string;
  onClose?: () => void;
};

export default function PostDetailsView(props: PostDetailsViewProps) {
  return <PostDetailsViewContent key={props.postId} {...props} />;
}

function PostDetailsViewContent({
  postId,
  onClose,
}: PostDetailsViewProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const [post, setPost] = useState<Post | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [commentTotal, setCommentTotal] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const commentsId = useId();
  const commentsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!commentsOpen) return;
    commentsRef.current?.querySelector("textarea")?.focus({ preventScroll: true });
    commentsRef.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [commentsOpen]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const row = await fetchPost(postId);
        let next = row;
        if (row.ownerUserId && (!row.ownerName || !row.ownerAvatarUrl)) {
          try {
            const profile = await fetchPublicProfessionalProfile(row.ownerUserId);
            next = {
              ...row,
              ownerName:
                row.ownerName ||
                profile.shopName ||
                profile.studioName ||
                profile.displayName,
              ownerAvatarUrl: row.ownerAvatarUrl || profile.profilePictureUrl,
              ownerRole: row.ownerRole || profile.role,
            };
          } catch {
            /* post body is enough without publisher enrichment */
          }
        }
        if (cancelled) return;
        setPost(next);
        setCommentTotal(next.commentCount);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setErrorKey(
          err instanceof ApiError ? err.message : "posts.errors.loadFailed",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [postId]);

  const closeCopiedToast = useCallback(() => setLinkCopied(false), []);

  if (status === "loading") {
    return (
      <div
        className="h-[28rem] animate-pulse rounded-[1.5rem] bg-white"
        aria-busy="true"
        data-testid="post-details-loading"
      />
    );
  }

  if (status === "error" || !post) {
    return (
      <div className="rounded-2xl border border-[var(--wesal-border)] bg-white p-6 text-sm text-[#b42318]">
        {errorKey?.startsWith("posts.") ? t(errorKey) : errorKey || t("posts.errors.loadFailed")}
        {onClose ? (
          <button type="button" className="btn-outline mt-4" onClick={onClose}>
            {t("common.close")}
          </button>
        ) : null}
      </div>
    );
  }

  const profileHref = post.ownerUserId
    ? `${PROFESSIONAL_PUBLIC_PATH}/${encodeURIComponent(post.ownerUserId)}`
    : null;
  const publisherName =
    post.ownerName?.trim() || t("posts.profile.untitled");
  const publisherInitial = (publisherName.charAt(0) || "?").toUpperCase();
  const roleLabel = formatOwnerRole(post.ownerRole, t);
  const createdLabel = formatRelativeTime(post.createdAt);

  return (
    <>
      <article
        className="overflow-hidden rounded-[1.5rem] border border-[var(--wesal-border)] bg-white shadow-[0_16px_40px_rgba(90,55,45,0.08)]"
        data-testid={`post-details-${post.id}`}
      >
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
          <ContentImageGallery key={post.id} images={post.images}
            emptyState={post.content?.trim() || t("posts.textOnly")} className="lg:min-h-[32rem]" />

          <div className="flex min-h-0 flex-col gap-4 p-4 sm:p-5">
            {onClose ? (
              <button
                type="button"
                className="self-start text-xs font-bold text-[var(--wesal-muted)]"
                onClick={onClose}
              >
                {t("common.close")}
              </button>
            ) : null}

            <header className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--wesal-pink)] text-sm font-bold text-[var(--wesal-maroon)]">
                  {post.ownerAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.ownerAvatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    publisherInitial
                  )}
                </span>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {profileHref ? (
                      <Link
                        href={profileHref}
                        className="truncate text-sm font-extrabold text-[var(--wesal-maroon-dark)] hover:underline"
                      >
                        {publisherName}
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-extrabold text-[var(--wesal-maroon-dark)]">
                        {publisherName}
                      </p>
                    )}
                    <VerifiedBadge />
                  </div>
                  <p className="mt-0.5 truncate text-[0.7rem] text-[var(--wesal-muted)]">
                    {[roleLabel, createdLabel].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
              <PostActionsMenu
                postId={post.id}
                providerUserId={post.ownerUserId}
                profileHref={profileHref}
                onCopied={() => setLinkCopied(true)}
              />
            </header>

            <div className="space-y-2">
              <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--wesal-text)]">
                {post.content?.trim() || t("posts.untitled")}
              </p>
              {post.price != null ? (
                <p className="text-base font-extrabold text-[var(--wesal-maroon)]">
                  {formatOfferAmount(post.price, locale)} {t("offers.currency")}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--wesal-muted)]">
              <span className="font-semibold" data-testid="post-save-count">
                {formatCompactCount(post.saveCount, locale)} {t("posts.stats.saves")}
              </span>
              <span className="font-semibold">
                {formatCompactCount(commentTotal, locale)} {t("posts.stats.comments")}
              </span>
            </div>

            <div className="flex items-center justify-start gap-3 border-y border-[var(--wesal-border)] py-3" data-testid="post-details-actions">
                <PostFavoriteButton
                  postId={post.id}
                  variant="icon"
                  initialSaved={post.isSavedByCurrentUser}
                  saveCount={post.saveCount}
                  onChanged={(saved, nextCount) => {
                    setPost((prev) =>
                      prev
                        ? {
                            ...prev,
                            isSavedByCurrentUser: saved,
                            saveCount: nextCount,
                          }
                        : prev,
                    );
                  }}
                />
                <button type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--wesal-border)] bg-white text-[var(--wesal-maroon)]"
                  aria-label={t("posts.stats.comments")} title={t("posts.stats.comments")}
                  aria-expanded={commentsOpen} aria-controls={commentsId} data-testid="post-comments-toggle"
                  onClick={() => setCommentsOpen(value => !value)}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 0 1 19 0Z" />
                  </svg>
                </button>
                <PostShareButton
                  postId={post.id}
                  variant="icon"
                  onCopied={() => setLinkCopied(true)}
                />
            </div>

            <div ref={commentsRef}>
            <PostCommentSection
              postId={post.id}
              className="min-h-0 flex-1 border-t border-[var(--wesal-border)] pt-4"
              onTotalChange={setCommentTotal}
              previewCount={2}
              composerVisible={commentsOpen}
              composerId={commentsId}
              onRequestComposer={() => setCommentsOpen(true)}
            />
            </div>
          </div>
        </div>
      </article>

      <SuccessToast
        open={linkCopied}
        message={t("posts.share.copiedSuccess")}
        onClose={closeCopiedToast}
      />
    </>
  );
}

function formatOwnerRole(
  role: string | null | undefined,
  t: (key: string) => string,
): string {
  const normalized = (role ?? "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("photo")) return t("posts.role.photographer");
  if (normalized.includes("coord") || normalized.includes("event")) {
    return t("posts.role.coordinator");
  }
  return role?.trim() || "";
}

function formatCompactCount(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(Math.max(0, value));
  } catch {
    return String(Math.max(0, value));
  }
}

function VerifiedBadge() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#2f80ed]" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="currentColor" />
      <path
        d="M6.2 10.2 8.6 12.6 13.8 7.4"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
