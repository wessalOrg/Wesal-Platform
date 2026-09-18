"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import HallImage, { HALL_IMAGE_PLACEHOLDER } from "@/components/halls/HallImage";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";

type HallHeroGalleryProps = {
  images: string[];
  hallName: string;
  description?: string;
};

export default function HallHeroGallery({
  images,
  hallName,
  description,
}: HallHeroGalleryProps) {
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
    setActiveIndex((current) => (current - 1 + gallery.length) % gallery.length);
  }, [gallery.length]);

  const showNext = useCallback(() => {
    setActiveIndex((current) => (current + 1) % gallery.length);
  }, [gallery.length]);

  const lightboxPrev = useCallback(() => {
    setLightboxIndex((current) =>
      current == null ? null : (current - 1 + gallery.length) % gallery.length,
    );
  }, [gallery.length]);

  const lightboxNext = useCallback(() => {
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
      if (event.key === "ArrowLeft") lightboxNext();
      if (event.key === "ArrowRight") lightboxPrev();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
    };
  }, [lightboxIndex, lightboxNext, lightboxPrev, closeLightbox]);

  const blurb =
    description?.trim() && description.trim().length > 140
      ? `${description.trim().slice(0, 137)}…`
      : description?.trim() || null;

  return (
    <>
      <section
        className="hall-hero-gallery relative min-w-0 overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink)]"
        aria-label={t("halls.gallery.openFull", { name: hallName })}
        data-testid="hall-hero-gallery"
      >
        {isEmptyGallery ? (
          <p
            className="absolute start-3 top-3 z-20 rounded-lg bg-white/90 px-3 py-1.5 text-xs text-[var(--wesal-muted)]"
            role="status"
          >
            {t("halls.gallery.empty")}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => openLightbox(activeIndex)}
          className="group relative block w-full cursor-zoom-in"
          aria-label={t("halls.gallery.openFull", { name: hallName })}
        >
          <div className="relative aspect-[16/10] w-full sm:aspect-[2/1] lg:aspect-[21/9]">
            <HallImage
              src={gallery[activeIndex] ?? HALL_IMAGE_PLACEHOLDER}
              alt={hallName}
              fill
              priority
              className="object-cover transition duration-500 ease-out group-hover:scale-[1.015]"
              sizes="100vw"
            />
            <div className="hall-hero-gallery-scrim" aria-hidden="true" />
            <div className="absolute inset-x-0 bottom-0 z-10 p-4 pb-8 text-start sm:p-6 sm:pb-9 lg:p-8 lg:pb-10">
              <h1 className="max-w-3xl text-2xl font-extrabold leading-tight text-white drop-shadow sm:text-3xl lg:text-[2.15rem]">
                {hallName}
              </h1>
              {blurb ? (
                <p className="mt-2 max-w-2xl text-sm leading-7 text-white/90 sm:text-base">
                  {blurb}
                </p>
              ) : null}
            </div>
          </div>
        </button>

        {gallery.length > 1 ? (
          <>
            <button
              type="button"
              onClick={showPrev}
              className="absolute end-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--wesal-maroon)] shadow sm:inline-flex"
              aria-label={t("halls.catalog.prevPage")}
            >
              ›
            </button>
            <button
              type="button"
              onClick={showNext}
              className="absolute start-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--wesal-maroon)] shadow sm:inline-flex"
              aria-label={t("halls.catalog.nextPage")}
            >
              ‹
            </button>
            <div
              className="absolute inset-x-0 bottom-3 z-20 flex justify-center gap-1.5"
              role="tablist"
              aria-label={hallName}
            >
              {gallery.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={index === activeIndex}
                  aria-label={`${index + 1} / ${gallery.length}`}
                  className={`h-2.5 rounded-full transition ${
                    index === activeIndex
                      ? "w-2.5 bg-[var(--wesal-maroon)]"
                      : "w-2.5 bg-white/55 hover:bg-white/80"
                  }`}
                  onClick={() => setActiveIndex(index)}
                />
              ))}
            </div>
          </>
        ) : null}
      </section>

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
              className="hall-lightbox-panel relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-[var(--wesal-pink)] shadow-[0_24px_60px_rgba(40,25,20,0.35)]"
            >
              <p id={lightboxTitleId} className="sr-only">
                {t("halls.gallery.openFull", { name: hallName })} —{" "}
                {lightboxIndex + 1} / {gallery.length}
              </p>
              <div className="relative min-h-0 flex-1 overflow-y-auto">
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
                <p className="text-sm font-medium text-[var(--wesal-text)]">
                  {lightboxIndex + 1} / {gallery.length}
                </p>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={closeLightbox}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wesal-pink-soft)] text-lg text-[var(--wesal-maroon)]"
                  aria-label={t("common.close")}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
