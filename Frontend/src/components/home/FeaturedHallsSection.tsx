"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import RegionFilterBar from "@/components/home/RegionFilterBar";
import { FEATURED_HALLS_FALLBACK } from "@/constants/featuredHallsFallback";
import { fetchFeaturedHalls, filterFeaturedByRegion } from "@/services/halls";
import type { FeaturedHall, HallRegion, PeriodStatus } from "@/types/hall";

type LoadStatus = "loading" | "ready" | "error";

export default function FeaturedHallsSection() {
  const [region, setRegion] = useState<HallRegion>("all");
  const [halls, setHalls] = useState<FeaturedHall[]>(
    FEATURED_HALLS_FALLBACK.slice(0, 6),
  );
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(true);
  const [previewHall, setPreviewHall] = useState<FeaturedHall | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const regionEmpty = status === "ready" && halls.length === 0;

  useEffect(() => {
    let active = true;

    void fetchFeaturedHalls(region).then((result) => {
      if (!active) return;

      if (result.source === "api") {
        setHalls(result.halls);
        setUsingFallback(false);
        setErrorMessage(null);
        setStatus("ready");
        return;
      }

      // Backend unavailable: keep homepage usable with local fallback + client filter.
      setHalls(filterFeaturedByRegion(FEATURED_HALLS_FALLBACK, region));
      setUsingFallback(true);
      setErrorMessage(result.error ?? null);
      setStatus("error");
    });

    return () => {
      active = false;
    };
  }, [region, reloadKey]);

  const handleRegionChange = (next: HallRegion) => {
    setErrorMessage(null);
    setStatus("loading");
    setRegion(next);
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setStatus("loading");
    setReloadKey((key) => key + 1);
  };

  return (
    <section
      className="bg-[var(--wesal-cream)] py-12 sm:py-16"
      aria-labelledby="featured-halls-heading"
      data-testid="featured-halls-section"
    >
      <div className="container-wesal">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="featured-halls-heading"
            className="text-2xl font-bold text-[var(--wesal-maroon)] sm:text-3xl"
          >
            قاعات مميزة لك
          </h2>
          <Link
            href="/halls"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--wesal-maroon)] transition hover:gap-1.5"
          >
            عرض الكل
            <ChevronIcon />
          </Link>
        </div>

        <RegionFilterBar
          value={region}
          onChange={handleRegionChange}
          disabled={status === "loading"}
        />

        <div className="mt-4">
          <p className="text-sm text-[var(--wesal-muted)]">قاعات معتمدة وموثوقة</p>
        </div>

        {status === "loading" ? (
          <div
            className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="featured-halls-loading"
            aria-busy="true"
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <HallCardSkeleton key={index} />
            ))}
          </div>
        ) : null}

        {status === "error" && usingFallback ? (
          <div
            className="mt-6 rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-3 text-center sm:text-start"
            data-testid="featured-halls-api-fallback"
            role="status"
          >
            <p className="text-sm text-[var(--wesal-text)]">
              تعذر الاتصال بالخادم حاليًا. يتم عرض قاعات تجريبية.
              {errorMessage ? ` (${errorMessage})` : ""}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="btn-outline mt-3"
              data-testid="featured-halls-retry"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : null}

        {status !== "loading" && regionEmpty ? (
          <div
            className="mt-8 rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] p-6 text-center"
            data-testid="region-empty-state"
          >
            <p className="text-[var(--wesal-text)]">
              لا توجد قاعات متاحة حاليًا في هذه المنطقة.
            </p>
            <button
              type="button"
              onClick={() => handleRegionChange("all")}
              className="btn-outline mt-4"
            >
              عرض جميع المناطق
            </button>
          </div>
        ) : null}

        {status !== "loading" && halls.length > 0 ? (
          <div
            className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            role="tabpanel"
            data-testid="featured-halls-grid"
          >
            {halls.map((hall, index) => (
              <HallCard
                key={hall.id}
                hall={hall}
                index={index}
                onOpen={() => setPreviewHall(hall)}
              />
            ))}
          </div>
        ) : null}
      </div>

      {previewHall ? (
        <HallPreviewDialog hall={previewHall} onClose={() => setPreviewHall(null)} />
      ) : null}
    </section>
  );
}

function HallCardSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)]"
      aria-hidden="true"
    >
      <div className="aspect-[4/3] animate-pulse bg-[var(--wesal-pink)]" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-[rgba(193,123,127,0.18)]" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-[rgba(193,123,127,0.12)]" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-[rgba(193,123,127,0.12)]" />
      </div>
    </div>
  );
}

function isRemoteImage(src: string) {
  return /^https?:\/\//i.test(src);
}

function HallImage({
  src,
  alt,
  className,
  sizes,
  fill = false,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  fill?: boolean;
}) {
  if (isRemoteImage(src)) {
    return (
      // Remote API hosts may vary; native img keeps homepage functional.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={
          fill
            ? `absolute inset-0 h-full w-full object-cover ${className ?? ""}`
            : className
        }
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      className={className}
      sizes={sizes}
      quality={75}
    />
  );
}

function HallCard({
  hall,
  index,
  onOpen,
}: {
  hall: FeaturedHall;
  index: number;
  onOpen: () => void;
}) {
  const capacityLabel = hall.capacityMax
    ? `${hall.capacity} - ${hall.capacityMax} شخص`
    : `${hall.capacity} شخص`;

  return (
    <article
      className="hall-card group overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] shadow-[0_10px_30px_rgba(90,55,45,0.07)]"
      style={{ animationDelay: `${index * 90}ms` }}
      data-testid={`hall-card-${hall.id}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full cursor-pointer text-start"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-[var(--wesal-pink)]">
          <HallImage
            src={hall.imageUrl}
            alt={hall.name}
            fill
            className="object-cover transition duration-500 ease-out group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(40,25,20,0.35)] via-transparent to-transparent"
            aria-hidden="true"
          />
          {hall.priceLabel ? (
            <span className="hall-price-badge absolute bottom-3 left-3 z-10">
              {formatPriceLabel(hall.priceLabel)}
            </span>
          ) : null}
        </div>

        <div className="space-y-2.5 p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-bold leading-snug text-[var(--wesal-text)]">
              {hall.name}
            </h3>
            {hall.rating != null ? (
              <span
                className="inline-flex shrink-0 items-center gap-1.5"
                aria-label={`التقييم ${hall.rating} من 5`}
              >
                <Stars rating={hall.rating} />
                <span className="text-sm font-semibold text-[var(--wesal-text)]">
                  {Number(hall.rating).toFixed(1)}
                </span>
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[var(--wesal-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <PinIcon />
              {hall.location}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <GuestsIcon />
              {capacityLabel}
            </span>
          </div>

          {hall.bookedPeriodsSummary ? (
            <p
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--wesal-maroon-soft)]"
              data-testid="hall-booked-summary"
            >
              <CalendarIcon />
              <span>
                محجوز:{" "}
                <span className="text-[var(--wesal-maroon)]">
                  {hall.bookedPeriodsSummary}
                </span>
              </span>
            </p>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700/80">
              <CalendarIcon />
              متاح للحجز
            </p>
          )}

          {hall.tags?.length ? (
            <p className="text-xs leading-6 text-[var(--wesal-muted)]/90">
              {hall.tags.join(" · ")}
            </p>
          ) : null}
        </div>
      </button>
    </article>
  );
}

function statusLabel(status: PeriodStatus) {
  return status === "booked" ? "Booked" : "Available";
}

function StatusBadge({ status }: { status: PeriodStatus }) {
  const booked = status === "booked";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[0.7rem] font-bold tracking-wide ${
        booked
          ? "bg-[rgba(193,123,127,0.16)] text-[var(--wesal-maroon-dark)]"
          : "bg-emerald-50 text-emerald-700"
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}

function HallPreviewDialog({
  hall,
  onClose,
}: {
  hall: FeaturedHall;
  onClose: () => void;
}) {
  const previewDay = hall.availabilityDays?.[0] ?? null;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      role="presentation"
      data-testid="hall-preview-dialog"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(40,25,20,0.45)] backdrop-blur-[2px]"
        aria-label="إغلاق"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hall-preview-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(60,35,30,0.22)]"
      >
        <div className="relative aspect-[16/10] bg-[var(--wesal-pink)]">
          <HallImage src={hall.imageUrl} alt="" fill className="object-cover" sizes="400px" />
          <button
            type="button"
            onClick={onClose}
            className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[var(--wesal-maroon)] shadow"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <h3 id="hall-preview-title" className="text-lg font-bold text-[var(--wesal-text)]">
              {hall.name}
            </h3>
            <p className="mt-1 text-sm text-[var(--wesal-muted)]">{hall.location}</p>
          </div>

          {previewDay ? (
            <div data-testid="hall-availability-day">
              <p className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--wesal-maroon)]">
                <CalendarIcon />
                {previewDay.dateLabel}
              </p>

              <ul className="space-y-2">
                {previewDay.periods.map((period) => (
                  <li
                    key={`${previewDay.dateLabel}-${period.label}`}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[var(--wesal-pink-soft)] px-3 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-[var(--wesal-text)]">{period.label}</p>
                      {period.time ? (
                        <p className="mt-0.5 text-xs text-[var(--wesal-muted)]">{period.time}</p>
                      ) : null}
                    </div>
                    <StatusBadge status={period.status} />
                  </li>
                ))}
              </ul>

              <p className="mt-3 text-xs leading-6 text-[var(--wesal-muted)]">
                كل يوم فيه فترتان مستقلتان يحدّدهما صاحب القاعة. عند الحجز تختار التاريخ
                والفترة المتاحة.
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--wesal-muted)]">لا توجد بيانات توفر حالياً.</p>
          )}

          <button type="button" onClick={onClose} className="btn-primary w-full">
            حسناً
          </button>
        </div>
      </div>
    </div>
  );
}

function formatPriceLabel(label: string) {
  if (label.includes("₪")) return label;
  return label.replace(/^([\d,.]+)\s*/, "$1 ₪ ");
}

function Stars({ rating }: { rating: number }) {
  const full = Math.round(Math.min(5, Math.max(0, Number(rating) || 0)));
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <StarIcon key={index} filled={index < full} />
      ))}
    </span>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StarIcon({ filled = true }: { filled?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "#E8B923" : "none"}
      stroke={filled ? "#E8B923" : "#D4B8B5"}
      strokeWidth="1.4"
      aria-hidden="true"
    >
      <path d="M12 3.6l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.9 7.2 18.5l.9-5.4L4.2 9.3l5.4-.8L12 3.6Z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-[var(--wesal-maroon)]">
      <path
        d="M12 21s6.5-5.4 6.5-10.2A6.5 6.5 0 1 0 5.5 10.8C5.5 15.6 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="10.5" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-[var(--wesal-maroon)]"
    >
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 9h16M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function GuestsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-[var(--wesal-maroon)]">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.2 19c.7-3.2 3-4.8 5.8-4.8s5.1 1.6 5.8 4.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="17.2" cy="9" r="2.3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 14.8c2.1.4 3.7 1.7 4.3 3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
