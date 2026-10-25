"use client";

import { useEffect, useId, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import { toYouTubeEmbedUrl, toYouTubeVideoId } from "@/lib/youtube-embed";

type HallYouTubeEmbedProps = {
  url?: string | null;
  /**
   * `link` keeps the hall-details text CTA.
   * `poster` shows a thumbnail card with a play button.
   */
  variant?: "link" | "poster";
};

/**
 * Hall YouTube video: opens an in-page embed modal.
 * Renders nothing when the hall has no valid YouTube link.
 * Unmounting the iframe on close stops playback.
 */
export default function HallYouTubeEmbed({
  url,
  variant = "link",
}: HallYouTubeEmbedProps) {
  const t = useT();
  const titleId = useId();
  const videoId = toYouTubeVideoId(url);
  const embedBase = toYouTubeEmbedUrl(url);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
    };
  }, [open]);

  if (!videoId || !embedBase) return null;

  const embedSrc = `${embedBase}?autoplay=1&rel=0&modestbranding=1`;

  const openModal = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  };

  const closeModal = () => setOpen(false);

  const modal =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[400] flex items-center justify-center p-3 sm:p-4"
            role="presentation"
            data-testid="hall-youtube-modal"
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default bg-[rgba(40,25,20,0.72)]"
              aria-label={t("common.close")}
              onClick={closeModal}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-[#1a1210] shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5 sm:px-4">
                <p id={titleId} className="truncate text-sm font-bold text-white/95">
                  {t("halls.details.youtubeWatch")}
                </p>
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label={t("common.close")}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/95 text-[var(--wesal-maroon)] shadow transition hover:bg-[var(--wesal-maroon)] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  data-testid="hall-youtube-close"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={embedSrc}
                  title={t("halls.details.youtube")}
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {variant === "poster" ? (
        <section
          className="overflow-hidden rounded-2xl border-0 bg-white p-4 sm:p-5"
          data-testid="hall-youtube"
        >
          <p className="mb-2 text-xs font-semibold text-[var(--wesal-muted)]">
            {t("halls.details.youtube")}
          </p>
          <button
            type="button"
            onClick={openModal}
            aria-label={t("halls.details.youtubeWatch")}
            className="group relative block aspect-video w-full overflow-hidden rounded-xl border-0 bg-black"
            data-testid="hall-youtube-open"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube poster */}
            <img
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt=""
              className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
              loading="lazy"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--wesal-maroon)] text-white shadow-[0_10px_28px_rgba(0,0,0,0.35)] transition group-hover:scale-105">
                <PlayIcon className="h-7 w-7" />
              </span>
            </span>
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8 text-start text-sm font-semibold text-white">
              {t("halls.details.youtubeWatch")}
            </span>
          </button>
        </section>
      ) : (
        <button
          type="button"
          onClick={openModal}
          className="group inline-flex items-center gap-2 text-base font-semibold text-[var(--wesal-text)]"
          data-testid="hall-youtube-link"
          aria-haspopup="dialog"
        >
          <YouTubeIcon />
          <span>
            <span className="font-bold text-[#241c18]">{t("halls.details.youtubeLead")}</span>{" "}
            <span className="font-bold text-[var(--wesal-maroon)] underline decoration-[var(--wesal-maroon)]/40 underline-offset-4 transition duration-200 group-hover:text-[var(--wesal-maroon-dark)] group-hover:decoration-[var(--wesal-maroon-dark)]">
              {t("halls.details.youtubeHere")}
            </span>
          </span>
        </button>
      )}
      {modal}
    </>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-[#c4302b]" aria-hidden="true">
      <path
        fill="currentColor"
        d="M23 12.2s0-3.2-.4-4.6c-.2-.9-.9-1.6-1.8-1.8C19.2 5.4 12 5.4 12 5.4s-7.2 0-8.8.4c-.9.2-1.6.9-1.8 1.8C1 9 1 12.2 1 12.2s0 3.2.4 4.6c.2.9.9 1.6 1.8 1.8 1.6.4 8.8.4 8.8.4s7.2 0 8.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.4.4-4.6.4-4.6Z"
      />
      <path fill="#fff" d="M9.8 15.5v-6.6l6.2 3.3-6.2 3.3Z" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M7 7l10 10M17 7 7 17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
