"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PostActionsMenu from "@/components/posts/PostActionsMenu";
import PostCommentSection from "@/components/posts/PostCommentSection";
import PostFavoriteButton from "@/components/posts/PostFavoriteButton";
import PostInquiryButton from "@/components/posts/PostInquiryButton";
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

export default function PostDetailsView({
  postId,
  onClose,
}: PostDetailsViewProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const [post, setPost] = useState<Post | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [commentTotal, setCommentTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorKey(null);
    setImageIndex(0);

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

  const image = post.images[imageIndex] ?? post.images[0] ?? null;
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
          <div className="relative min-h-[18rem] bg-[var(--wesal-pink)] lg:min-h-[32rem]">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-[var(--wesal-muted)]">
                {post.content?.trim() || t("posts.textOnly")}
              </div>
            )}

            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
              {post.images.length > 1 ? (
                <span className="rounded-full bg-black/45 px-2.5 py-1 text-[0.7rem] font-bold text-white">
                  {imageIndex + 1}/{post.images.length}
                </span>
              ) : (
                <span />
              )}
              <PostFavoriteButton
                postId={post.id}
                initialSaved={post.isSavedByCurrentUser}
                saveCount={post.saveCount}
                className="!border-0 !bg-white/90 !px-2.5 !py-2 shadow-[0_8px_18px_rgba(0,0,0,0.12)]"
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
            </div>

            {post.images.length > 1 ? (
              <>
                <button
                  type="button"
                  className="absolute start-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--wesal-maroon)] shadow"
                  aria-label={t("posts.prevImage")}
                  onClick={() =>
                    setImageIndex((index) =>
                      index <= 0 ? post.images.length - 1 : index - 1,
                    )
                  }
                >
                  <ChevronIcon dir="prev" />
                </button>
                <button
                  type="button"
                  className="absolute end-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--wesal-maroon)] shadow"
                  aria-label={t("posts.nextImage")}
                  onClick={() =>
                    setImageIndex((index) =>
                      index >= post.images.length - 1 ? 0 : index + 1,
                    )
                  }
                >
                  <ChevronIcon dir="next" />
                </button>
                <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                  {post.images.map((img, index) => (
                    <button
                      key={img.id}
                      type="button"
                      className={`h-2 w-2 rounded-full ${
                        index === imageIndex ? "bg-white" : "bg-white/50"
                      }`}
                      aria-label={t("posts.imageDot", { index: index + 1 })}
                      onClick={() => setImageIndex(index)}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>

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
              <span className="font-semibold">
                {formatCompactCount(post.saveCount, locale)} {t("posts.stats.saves")}
              </span>
              <span className="font-semibold">
                {formatCompactCount(commentTotal, locale)} {t("posts.stats.comments")}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 border-y border-[var(--wesal-border)] py-3">
              <PostFavoriteButton
                postId={post.id}
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
              <PostShareButton
                postId={post.id}
                onCopied={() => setLinkCopied(true)}
              />
              {profileHref ? (
                <Link
                  href={profileHref}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--wesal-border)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--wesal-maroon)]"
                >
                  {t("posts.viewPublisher")}
                </Link>
              ) : null}
            </div>

            <PostInquiryButton kind="post" contentId={post.id} className="w-full sm:w-auto" />

            <PostCommentSection
              postId={post.id}
              className="min-h-0 flex-1 border-t border-[var(--wesal-border)] pt-4"
              onTotalChange={setCommentTotal}
            />
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

function ChevronIcon({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 ${dir === "prev" ? "rtl:rotate-180" : "rotate-180 rtl:rotate-0"}`}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M14.5 6 8.5 12l6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
