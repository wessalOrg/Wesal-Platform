"use client";

import { useState, type ReactNode } from "react";
import AuthenticatedApiImage from "@/components/ui/AuthenticatedApiImage";
import { useT } from "@/i18n";

type ContentImageGalleryProps = {
  images: ReadonlyArray<{ id: string; url: string }>;
  emptyState: ReactNode;
  children?: ReactNode;
  className?: string;
};

export default function ContentImageGallery({ images, emptyState, children, className = "" }: ContentImageGalleryProps) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const active = Math.max(0, Math.min(index, images.length - 1));
  const image = images[active];
  const move = (step: number) => setIndex((active + step + images.length) % images.length);

  return <div className={`relative min-h-[18rem] min-w-0 bg-[var(--wesal-pink)] ${className}`} data-testid="content-image-gallery">
    {image ? <AuthenticatedApiImage key={image.id + image.url} src={image.url}
      alt={t("posts.imageDot", { index: active + 1 })} loading="eager" showErrorFallback
      className="absolute inset-0 h-full w-full object-contain"
      loadingFallback={<p className="absolute inset-0 grid place-items-center text-sm text-[var(--wesal-muted)]" role="status">{t("common.loading")}</p>}
      fallback={<p className="absolute inset-0 grid place-items-center text-sm text-[var(--wesal-muted)]" role="status">{t("offers.card.noImage")}</p>} />
      : <div className="absolute inset-0 flex items-center justify-center overflow-auto whitespace-pre-wrap break-words p-6 text-sm text-[var(--wesal-muted)]" data-testid="content-gallery-empty">{emptyState}</div>}
    <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
      {images.length > 1 ? <span className="rounded-full bg-black/45 px-2.5 py-1 text-xs font-bold text-white" data-testid="content-gallery-count" aria-live="polite">{active + 1}/{images.length}</span> : <span />}
      {children}
    </div>
    {images.length > 1 ? <>
      {([-1, 1] as const).map((step) => <button key={step} type="button"
        className={`absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--wesal-maroon)] shadow ${step === -1 ? "start-3" : "end-3"}`}
        aria-label={t(step === -1 ? "posts.prevImage" : "posts.nextImage")} onClick={() => move(step)}>
        <svg viewBox="0 0 24 24" className={`h-4 w-4 ${step === -1 ? "rtl:rotate-180" : "rotate-180 rtl:rotate-0"}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
      </button>)}
      <div className="absolute inset-x-0 bottom-2 flex flex-wrap justify-center gap-1 px-3">
        {images.map((entry, position) => <button key={entry.id} type="button"
          className="grid h-8 w-8 place-items-center rounded-full bg-black/25 focus-visible:outline-2 focus-visible:outline-[var(--wesal-maroon-dark)]"
          aria-label={t("posts.imageDot", { index: position + 1 })} aria-pressed={position === active} onClick={() => setIndex(position)}>
          <span className={`h-2 w-2 rounded-full ${position === active ? "bg-white" : "bg-white/50"}`} />
        </button>)}
      </div>
    </> : null}
  </div>;
}
