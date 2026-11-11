"use client";

import Link from "next/link";
import { useT } from "@/i18n";
import type { MessageContextCard } from "@/types/messages";

type ProductInquiryCardProps = {
  context: MessageContextCard;
  className?: string;
  /** Compact inline bubble card vs larger sidebar-style card. */
  variant?: "inline" | "panel";
};

/** Pinned post/offer preview when a chat was started from an inquiry (Section 13.2 / Figma). */
export default function ProductInquiryCard({
  context,
  className = "",
  variant = "inline",
}: ProductInquiryCardProps) {
  const t = useT();
  const title = context.contextTitle?.trim() || t("messages.inquiry.untitled");
  const text = context.contextText?.trim() || "";
  const imageUrl = context.contextImageUrl?.trim() || null;
  const href = context.contextPostId
    ? `/posts/${encodeURIComponent(context.contextPostId)}`
    : context.contextOfferId
      ? `/discover?offer=${encodeURIComponent(context.contextOfferId)}`
      : null;
  const isPost = Boolean(context.contextPostId);
  const kindLabel = isPost
    ? t("messages.linkedPost.badge")
    : context.contextOfferId
      ? t("messages.inquiry.offer")
      : t("messages.inquiry.item");
  const viewLabel = isPost
    ? t("messages.linkedPost.view")
    : t("messages.inquiry.viewItem");
  const unavailable = context.contextItemAvailable === false;
  const panel = variant === "panel";

  const body = (
    <article
      className={`overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-[#f5f1ed] ${
        panel ? "shadow-[0_10px_24px_rgba(90,55,45,0.08)]" : ""
      } ${className}`}
      data-testid="product-inquiry-card"
      data-post-id={context.contextPostId ?? undefined}
      data-offer-id={context.contextOfferId ?? undefined}
    >
      {panel && imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-36 w-full object-cover" />
      ) : null}
      <div className={`flex min-w-0 items-stretch gap-3 ${panel ? "p-3" : "p-0"}`}>
        {!panel ? (
          <div className="relative h-[4.25rem] w-[4.25rem] shrink-0 bg-[var(--wesal-pink-soft)]">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[0.65rem] font-semibold text-[var(--wesal-maroon)]">
                {kindLabel}
              </span>
            )}
          </div>
        ) : null}
        <div className={`min-w-0 flex-1 ${panel ? "" : "py-2 pe-3"}`}>
          <p className="text-[0.65rem] font-bold text-[var(--wesal-gold)]">{kindLabel}</p>
          <h3 className="mt-0.5 line-clamp-2 text-sm font-bold text-[var(--wesal-text)]">
            {title}
          </h3>
          {text && panel ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--wesal-muted)]">
              {text}
            </p>
          ) : null}
          {unavailable ? (
            <p className="mt-1 text-[0.65rem] font-semibold text-[#a86267]">
              {t("messages.inquiry.unavailable")}
            </p>
          ) : href ? (
            <span className="mt-1.5 inline-flex items-center gap-1 text-[0.7rem] font-bold text-[var(--wesal-maroon)]">
              {viewLabel}
              <ArrowIcon />
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );

  if (!href || unavailable) return body;

  return (
    <Link
      href={href}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wesal-maroon)]"
    >
      {body}
    </Link>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3 rtl:rotate-180" fill="none" aria-hidden="true">
      <path
        d="M6 3.5 10.5 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
