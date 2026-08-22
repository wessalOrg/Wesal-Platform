"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import HallImage, { HALL_IMAGE_PLACEHOLDER } from "@/components/halls/HallImage";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";

type HallGalleryProps = {
  images: string[];
  hallName: string;
};

export default function HallGallery({ images, hallName }: HallGalleryProps) {
  const t = useT();
  const isEmptyGallery = images.length === 0;
  const gallery = isEmptyGallery ? [HALL_IMAGE_PLACEHOLDER] : images;
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lightboxTitleId = useId();

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const showPrev = useCallback(() => {
    setLightboxIndex((current) =>
      current == null ? null : (current - 1 + gallery.length) % gallery.length,
    );
  }, [gallery.length]);

  const showNext = useCallback(() => {
    setLightboxIndex((current) =>
      current == null ? null : (current + 1) % gallery.length,
    );
  }, [gallery.length]);

  useEffect(() => {
    setActiveIndex(0);
  }, [images]);

  useEffect(() => {
    if (lightboxIndex == null) return;

    lockBodyScroll();
    closeButtonRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") showNext();
      if (event.key === "ArrowRight") showPrev();
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
    };
  }, [lightboxIndex, showNext, showPrev, closeLightbox]);

  return (
    <>
      <div className="min-w-0 space-y-3" data-testid="hall-gallery">
        {isEmptyGallery ? (
          <p
            className="rounded-xl border border-dashed border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-2 text-center text-xs text-[var(--wesal-muted)]"
            role="status"
            data-testid="hall-gallery-empty"
          >
            {t("halls.gallery.empty")}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => openLightbox(activeIndex)}
          className="group relative block w-full max-w-full cursor-zoom-in overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink)]"
          aria-label={t("halls.gallery.openFull", { name: hallName })}
        >
          <div className="relative aspect-[16/10] w-full sm:aspect-[21/10]">
            <HallImage
              src={gallery[activeIndex] ?? HALL_IMAGE_PLACEHOLDER}
              alt={hallName}
              fill
              priority
              className="object-cover transition duration-500 ease-out group-hover:scale-[1.02]"
              sizes="(max-width: 768px) 100vw, 70vw"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(40,25,20,0.2)] via-transparent to-transparent"
              aria-hidden="true"
            />
          </div>
        </button>

        {!isEmptyGallery && gallery.length > 1 ? (
          <div
            className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(193,123,127,0.35)]"
            role="list"
            aria-label={t("halls.gallery.openFull", { name: hallName })}
          >
            {gallery.map((image, index) => {
              const active = index === activeIndex;
              return (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  role="listitem"
                  onClick={() => {
                    setActiveIndex(index);
                    openLightbox(index);
                  }}
                  className={`relative h-16 w-24 shrink-0 snap-start overflow-hidden rounded-xl border-2 transition sm:h-20 sm:w-28 ${
                    active
                      ? "border-[var(--wesal-maroon)] shadow-[0_6px_16px_rgba(193,123,127,0.25)]"
                      : "border-[var(--wesal-border)] opacity-80 hover:opacity-100"
                  }`}
                  aria-label={`${index + 1} / ${gallery.length}`}
                  aria-current={active ? "true" : undefined}
                >
                  <HallImage
                    src={image}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="112px"
                  />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {lightboxIndex != null ? (
        <div
          className="hall-lightbox fixed inset-0 z-[120] overflow-y-auto overscroll-contain"
          role="presentation"
          data-testid="hall-gallery-lightbox"
        >
          <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
            <button
              type="button"
              className="fixed inset-0 bg-[rgba(40,25,20,0.72)] backdrop-blur-[3px]"
              aria-label={t("common.close")}
              onClick={closeLightbox}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={lightboxTitleId}
              className="hall-lightbox-panel relative z-10 flex w-full max-w-5xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-[var(--wesal-pink)] shadow-[0_24px_60px_rgba(40,25,20,0.35)]"
            >
              <p id={lightboxTitleId} className="sr-only">
                {t("halls.gallery.openFull", { name: hallName })} —{" "}
                {lightboxIndex + 1} / {gallery.length}
              </p>

              <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="relative aspect-[16/10] min-h-[200px] w-full sm:min-h-[300px]">
                  <HallImage
                    src={gallery[lightboxIndex] ?? HALL_IMAGE_PLACEHOLDER}
                    alt={`${hallName} — ${lightboxIndex + 1}`}
                    fill
                    priority
                    className="object-contain"
                    sizes="100vw"
                  />
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--wesal-border)] bg-white/95 px-4 py-3">
                <p className="text-sm font-medium text-[var(--wesal-text)]" aria-hidden="true">
                  {lightboxIndex + 1} / {gallery.length}
                </p>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={closeLightbox}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wesal-pink-soft)] text-lg text-[var(--wesal-maroon)] transition hover:bg-[var(--wesal-pink)]"
                  aria-label={t("common.close")}
                >
                  ✕
                </button>
              </div>

              {gallery.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={showPrev}
                    className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--wesal-maroon)] shadow"
                    aria-label={t("halls.catalog.prevPage")}
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    onClick={showNext}
                    className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--wesal-maroon)] shadow"
                    aria-label={t("halls.catalog.nextPage")}
                  >
                    ‹
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
