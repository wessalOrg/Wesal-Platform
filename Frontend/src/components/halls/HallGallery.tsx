"use client";

import { useCallback, useEffect, useState } from "react";
import HallMedia from "@/components/halls/HallMedia";

type HallGalleryProps = {
  name: string;
  images: string[];
};

export default function HallGallery({ name, images }: HallGalleryProps) {
  const photos = images.length > 0 ? images : [];
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (photos.length === 0) return;
      setZoomed(false);
      setActive((current) => (current + dir + photos.length) % photos.length);
    },
    [photos.length],
  );

  const closeLightbox = useCallback(() => {
    setLightbox(false);
    setZoomed(false);
  }, []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, go, closeLightbox]);

  if (photos.length === 0) {
    return (
      <div
        className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl bg-[#f3ece8] text-sm text-[var(--wesal-muted)]"
        data-testid="hall-gallery-empty"
      >
        لا توجد صور متاحة
      </div>
    );
  }

  const cover = photos[active];
  const thumbs = photos.slice(0, 3);

  return (
    <section aria-label="معرض صور القاعة" data-testid="hall-gallery" className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-[#f3ece8]">
        <button
          type="button"
          className="relative block aspect-[4/3] w-full cursor-zoom-in"
          onClick={() => setLightbox(true)}
          aria-label="فتح الصورة بملء الشاشة"
          data-testid="hall-gallery-main"
        >
          <HallMedia
            src={cover}
            alt={`${name} — الصورة ${active + 1}`}
            className="absolute inset-0 h-full w-full object-cover object-center"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </button>

        {photos.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--wesal-maroon)] shadow sm:right-3 sm:h-10 sm:w-10"
              aria-label="الصورة التالية"
              data-testid="hall-gallery-next"
            >
              <Chevron dir="right" />
            </button>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--wesal-maroon)] shadow sm:left-3 sm:h-10 sm:w-10"
              aria-label="الصورة السابقة"
              data-testid="hall-gallery-prev"
            >
              <Chevron dir="left" />
            </button>
          </>
        ) : null}
      </div>

      {thumbs.length > 1 ? (
        <ul
          className="flex gap-2.5 overflow-x-auto pb-1"
          data-testid="hall-gallery-thumbs"
        >
          {thumbs.map((src, index) => {
            const selected = index === active || (active >= 3 && index === 0);
            return (
              <li key={`${src}-${index}`} className="min-w-[30%] shrink-0 sm:min-w-0 sm:flex-1">
                <button
                  type="button"
                  onClick={() => setActive(index)}
                  className={`relative aspect-[4/3] w-full overflow-hidden rounded-xl ${
                    selected
                      ? "ring-2 ring-[var(--wesal-maroon)] ring-offset-2"
                      : "opacity-90"
                  }`}
                  aria-label={`عرض الصورة ${index + 1}`}
                  aria-pressed={index === active}
                >
                  <HallMedia
                    src={src}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover object-center"
                    sizes="160px"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {lightbox ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/90 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="عرض الصورة بملء الشاشة"
          data-testid="hall-gallery-lightbox"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-zoom-out"
            aria-label="إغلاق"
            onClick={closeLightbox}
          />
          <div className="relative z-10 max-h-[90svh] w-full max-w-5xl">
            <button
              type="button"
              className={`relative mx-auto block w-full overflow-auto rounded-xl bg-black/30 ${
                zoomed ? "max-h-[78svh] cursor-zoom-out" : "cursor-zoom-in"
              }`}
              onClick={(event) => {
                event.stopPropagation();
                setZoomed((value) => !value);
              }}
              aria-label={zoomed ? "تصغير الصورة" : "تكبير الصورة"}
            >
              <span
                className={`relative mx-auto block ${
                  zoomed
                    ? "min-h-[120svh] min-w-[170%]"
                    : "aspect-[4/3] max-h-[78svh]"
                }`}
              >
                <HallMedia
                  src={cover}
                  alt={`${name} — ملء الشاشة`}
                  className="absolute inset-0 h-full w-full object-contain"
                  sizes="100vw"
                  priority
                />
              </span>
            </button>
            {photos.length > 1 ? (
              <p className="mt-3 text-center text-sm text-white/80">
                {active + 1} / {photos.length}
              </p>
            ) : null}
          </div>
          {photos.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => go(1)}
                className="absolute right-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[var(--wesal-maroon)]"
                aria-label="الصورة التالية"
              >
                <Chevron dir="right" />
              </button>
              <button
                type="button"
                onClick={() => go(-1)}
                className="absolute left-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[var(--wesal-maroon)]"
                aria-label="الصورة السابقة"
              >
                <Chevron dir="left" />
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute left-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wesal-maroon)] text-white"
            aria-label="إغلاق العرض الكامل"
          >
            <CloseIcon />
          </button>
        </div>
      ) : null}

      <span className="sr-only">
        صورة {active + 1} من {photos.length}
      </span>
    </section>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={dir === "right" ? "M14 6l-6 6 6 6" : "M10 6l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
