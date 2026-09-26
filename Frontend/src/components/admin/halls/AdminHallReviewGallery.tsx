"use client";

import { useState } from "react";
import { useT } from "@/i18n";

type AdminHallReviewGalleryProps = {
  hallName: string;
  photos: string[];
};

/**
 * Cover + thumbnail strip for Admin hall review (Edit 17).
 * One broken thumb must not break the gallery.
 */
export default function AdminHallReviewGallery({
  hallName,
  photos,
}: AdminHallReviewGalleryProps) {
  const t = useT();
  const [selected, setSelected] = useState(0);
  const [broken, setBroken] = useState<Record<string, true>>({});

  const valid = photos.filter((url) => url && !broken[url]);
  const activeIndex = Math.min(selected, Math.max(valid.length - 1, 0));
  const active = valid[activeIndex] ?? null;
  const extraCount = Math.max(valid.length - 6, 0);

  if (!active) {
    return (
      <div
        className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] text-sm text-[var(--wesal-muted)]"
        data-testid="admin-hall-gallery-empty"
        role="status"
      >
        {t("admin.halls.detail.mediaEmpty")}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3" data-testid="admin-hall-gallery">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink)] shadow-[0_10px_28px_rgba(90,55,45,0.08)]">
        <span className="absolute start-3 top-3 z-10 rounded-md bg-[var(--wesal-maroon-dark)]/90 px-2.5 py-1 text-[0.7rem] font-semibold text-white">
          {t("admin.halls.detail.coverLabel")}
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={active}
          alt={hallName}
          className="aspect-[4/3] w-full object-cover"
          onError={() => {
            setBroken((current) => ({ ...current, [active]: true }));
          }}
        />
        {valid.length > 1 ? (
          <>
            <button
              type="button"
              className="absolute start-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--wesal-maroon)] shadow"
              aria-label={t("admin.halls.detail.mediaPrev")}
              onClick={() =>
                setSelected((index) => (index - 1 + valid.length) % valid.length)
              }
            >
              ‹
            </button>
            <button
              type="button"
              className="absolute end-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--wesal-maroon)] shadow"
              aria-label={t("admin.halls.detail.mediaNext")}
              onClick={() => setSelected((index) => (index + 1) % valid.length)}
            >
              ›
            </button>
            <span className="absolute bottom-3 start-3 rounded-md bg-black/55 px-2 py-0.5 text-[0.7rem] font-semibold text-white">
              {activeIndex + 1} / {valid.length}
            </span>
          </>
        ) : null}
      </div>

      {valid.length > 1 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {valid.slice(0, 6).map((url, index) => {
            const isLastVisible = index === 5 && extraCount > 0;
            return (
              <li key={url}>
                <button
                  type="button"
                  className={`relative block aspect-square w-full overflow-hidden rounded-xl border ${
                    index === activeIndex
                      ? "border-[var(--wesal-maroon)] ring-2 ring-[var(--wesal-maroon)]/30"
                      : "border-[var(--wesal-border)]"
                  }`}
                  aria-label={t("admin.halls.detail.mediaThumb", { index: index + 1 })}
                  aria-current={index === activeIndex || undefined}
                  onClick={() => setSelected(index)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => {
                      setBroken((current) => ({ ...current, [url]: true }));
                    }}
                  />
                  {isLastVisible ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-xs font-bold text-white">
                      +{extraCount} {t("admin.halls.detail.mediaMore")}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
