"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n";
import { toYouTubeVideoId } from "@/lib/youtube-embed";

type HallYouTubeEmbedProps = {
  url?: string | null;
};

/**
 * Hall video: a poster card that opens the YouTube player in a popup window.
 * Renders nothing when the hall has no valid YouTube link.
 */
export default function HallYouTubeEmbed({ url }: HallYouTubeEmbedProps) {
  const t = useT();
  const videoId = toYouTubeVideoId(url);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!videoId) return null;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-5"
      data-testid="hall-youtube"
    >
      <p className="mb-2 text-xs font-semibold text-[var(--wesal-muted)]">
        {t("halls.details.youtube")}
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("halls.details.youtubeWatch")}
        className="group relative block aspect-video w-full overflow-hidden rounded-xl border border-[var(--wesal-border)] bg-black"
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
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-7 w-7">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
            </svg>
          </span>
        </span>
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8 text-start text-sm font-semibold text-white">
          {t("halls.details.youtubeWatch")}
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          role="presentation"
          data-testid="hall-youtube-modal"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-[rgba(40,25,20,0.7)]"
            aria-label={t("common.close")}
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("halls.details.youtube")}
            className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--wesal-gold)] bg-black shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("common.close")}
              className="absolute end-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[var(--wesal-maroon)] shadow transition hover:bg-[var(--wesal-maroon)] hover:text-white"
              data-testid="hall-youtube-close"
            >
              ✕
            </button>
            <div className="aspect-video w-full">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                title={t("halls.details.youtube")}
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
