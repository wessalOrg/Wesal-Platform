"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import HallRejectionReasonNotice from "@/components/owner-management/halls/HallRejectionReasonNotice";
import OwnerHallAdminLockedNotice from "@/components/halls/OwnerHallAdminLockedNotice";
import SubscriptionExpiryWarningBanner from "@/components/halls/subscription/SubscriptionExpiryWarningBanner";
import SubscriptionPaymentNotice from "@/components/halls/subscription/SubscriptionPaymentNotice";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { HALL_REGION_LABEL_KEYS, isHallRegion } from "@/constants/hallRegions";
import { useAddHallInitiation } from "@/hooks/useAddHallInitiation";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import { useSubscription } from "@/hooks/useSubscription";
import { HALL_OWNER_CALENDAR_PATH } from "@/lib/account-profile-path";
import {
  ownerHallNotificationsPath,
  ownerHallPath,
  ownerHallViewPath,
} from "@/lib/hall-owner-query-keys";
import { localizeHallName } from "@/lib/localize-hall-display";
import { GoldStar } from "@/components/ui/GoldStar";
import { fetchOwnerHallDetails } from "@/services/hall-owner-hall-management";
import { fetchHallById } from "@/services/halls";
import { useT } from "@/i18n";
import type { HallOwnerHall } from "@/types/hall-owner-halls";
import type { HallOwnerHallDetails } from "@/types/hall-owner-hall-management";

type HallLane = "available" | "review" | "unavailable";
type HallFilter = "all" | HallLane;

function hallLane(hall: HallOwnerHall): HallLane {
  if (hall.adminLocked || hall.systemLocked || hall.status === "Rejected") {
    return "unavailable";
  }
  if (hall.status === "Approved" && hall.paymentStatus === "Paid") return "available";
  return "review";
}

export default function OwnerHallsPage() {
  const t = useT();
  const lang = useUiLang();
  const { halls, isLoading, status, errorKey, refetch, isRefreshing } =
    useHallOwnerHalls();
  const { startAddHall, isInitiating } = useAddHallInitiation();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HallFilter>("all");
  const [detailsById, setDetailsById] = useState<Record<string, HallOwnerHallDetails>>({});

  const hallIds = halls.map((hall) => hall.id).join("|");

  useEffect(() => {
    const ids = hallIds ? hallIds.split("|") : [];
    if (ids.length === 0) return;
    let cancelled = false;
    void Promise.all(
      ids.map(async (id) => {
        try {
          const details = await fetchOwnerHallDetails(id);
          if (details.rating != null) return [id, details] as const;
          try {
            const publicHall = await fetchHallById(id);
            if (publicHall.status === "ok" && publicHall.hall.rating != null) {
              return [
                id,
                {
                  ...details,
                  rating: publicHall.hall.rating,
                  reviewCount: publicHall.hall.reviewCount ?? null,
                },
              ] as const;
            }
          } catch {
            /* keep owner details without rating */
          }
          return [id, details] as const;
        } catch {
          return null;
        }
      }),
    ).then((rows) => {
      if (cancelled) return;
      const next: Record<string, HallOwnerHallDetails> = {};
      for (const row of rows) {
        if (row) next[row[0]] = row[1];
      }
      setDetailsById(next);
    });
    return () => {
      cancelled = true;
    };
  }, [hallIds]);

  const counts = useMemo(() => {
    const available = halls.filter((hall) => hallLane(hall) === "available").length;
    const review = halls.filter((hall) => hallLane(hall) === "review").length;
    const unavailable = halls.filter((hall) => hallLane(hall) === "unavailable").length;
    return { total: halls.length, available, review, unavailable };
  }, [halls]);

  const visibleHalls = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return halls.filter((hall) => {
      if (filter !== "all" && hallLane(hall) !== filter) return false;
      if (!needle) return true;
      const details = detailsById[hall.id];
      const name = localizeHallName(hall.id, hall.name, lang).toLowerCase();
      const region = details?.region ? details.region.toLowerCase() : "";
      const address = details?.address?.toLowerCase() ?? "";
      return name.includes(needle) || region.includes(needle) || address.includes(needle);
    });
  }, [detailsById, filter, halls, lang, query]);

  const showError = status === "error" && halls.length === 0;
  const expiryWarnings = halls.filter((item) => item.expiryWarning);
  const paymentDueHalls = halls.filter(
    (item) => item.status === "Approved" && item.paymentStatus !== "Paid",
  );

  function beginAddHall() {
    if (!isInitiating) void startAddHall();
  }

  return (
    <div className="space-y-5" data-testid="owner-halls-page">
      <header className="owner-halls-page-intro">
        <h1 className="text-xl font-extrabold text-[var(--wesal-maroon-dark)]">
          {t("owner.hallsPage.title")}
        </h1>
        <p className="mt-1 text-xs leading-5 text-[var(--wesal-muted)]">
          {t("owner.hallsPage.subtitle")}
        </p>
      </header>

      {paymentDueHalls.length > 0 ? (
        <section
          className="space-y-3"
          aria-label={t("owner.subscription.paymentNotice.section")}
          data-testid="owner-halls-payment-notices"
        >
          {paymentDueHalls.map((hall) => (
            <SubscriptionPaymentNotice
              key={hall.id}
              hallId={hall.id}
              hallName={localizeHallName(hall.id, hall.name, lang)}
              paymentStatus={hall.paymentStatus}
            />
          ))}
        </section>
      ) : null}

      {expiryWarnings.length > 0 ? (
        <section
          className="space-y-3"
          aria-label={t("owner.subscription.expiryWarning.section")}
          data-testid="owner-halls-expiry-warnings"
        >
          {expiryWarnings.map((hall) =>
            hall.expiryWarning ? (
              <SubscriptionExpiryWarningBanner
                key={hall.id}
                hallId={hall.id}
                hallName={localizeHallName(hall.id, hall.name, lang)}
                cycleEnd={hall.expiryWarning.cycleEnd}
                daysRemaining={hall.expiryWarning.daysRemaining}
              />
            ) : null,
          )}
        </section>
      ) : null}

      {isLoading && halls.length === 0 ? (
        <div className="h-40 animate-pulse rounded-[1.4rem] bg-white/80" aria-busy="true" />
      ) : null}

      {showError ? (
        <section className="rounded-2xl bg-white p-6" role="alert">
          <p className="text-sm text-[var(--wesal-muted)]">
            {t(errorKey ?? "owner.management.halls.loadError")}
          </p>
          <button
            type="button"
            className="btn-outline mt-4"
            disabled={isLoading || isRefreshing}
            onClick={() => refetch()}
          >
            {t("common.retry")}
          </button>
        </section>
      ) : null}

      {!isLoading && !showError && halls.length === 0 ? (
        <div className="seeker-pending-empty" data-testid="owner-halls-page-empty">
          <p>{t("owner.hallsEmpty")}</p>
          <button
            type="button"
            className="seeker-home-soft-btn"
            disabled={isInitiating}
            onClick={beginAddHall}
          >
            {t("owner.cta.addHall")}
          </button>
        </div>
      ) : null}

      {halls.length > 0 ? (
        <>
          <div className="flex flex-col gap-3 rounded-[24px] border border-[color-mix(in_srgb,var(--wesal-maroon)_18%,var(--wesal-border))] bg-white p-3 shadow-[0_8px_22px_rgba(90,55,45,0.05)] sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">{t("owner.hallsPage.search")}</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("owner.hallsPage.search")}
                className="h-9 w-full rounded-xl border border-[color-mix(in_srgb,var(--wesal-maroon)_16%,var(--wesal-border))] bg-white px-3 text-xs text-[var(--wesal-text)] outline-none focus:border-[var(--wesal-maroon)] focus:ring-2 focus:ring-[var(--wesal-maroon)]/20"
              />
            </label>
            <div className="grid w-full grid-cols-2 gap-1.5 px-1 sm:flex sm:w-auto sm:flex-wrap sm:justify-end sm:gap-2 sm:px-0">
              <FilterChip
                active={filter === "all"}
                label={`${t("owner.hallsPage.filter.all")} (${counts.total})`}
                onClick={() => setFilter("all")}
              />
              <FilterChip
                active={filter === "available"}
                label={`${t("owner.hallsPage.filter.available")} (${counts.available})`}
                onClick={() => setFilter("available")}
              />
              <FilterChip
                active={filter === "review"}
                label={`${t("owner.hallsPage.filter.review")} (${counts.review})`}
                onClick={() => setFilter("review")}
              />
              <FilterChip
                active={filter === "unavailable"}
                label={`${t("owner.hallsPage.filter.unavailable")} (${counts.unavailable})`}
                onClick={() => setFilter("unavailable")}
              />
            </div>
          </div>

          {visibleHalls.length === 0 ? (
            <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-[var(--wesal-muted)]">
              {t("owner.hallsPage.emptySearch")}
            </p>
          ) : (
            <ul className="grid gap-4" data-testid="owner-halls-page-list">
              {visibleHalls.map((hall, index) => (
                <OwnerHallCard
                  key={hall.id}
                  hall={hall}
                  details={detailsById[hall.id]}
                  index={index}
                />
              ))}
            </ul>
          )}

          <div className="flex justify-center">
            <section className="owner-add-hall-banner relative w-full max-w-3xl overflow-hidden rounded-[1.15rem] border border-[color-mix(in_srgb,var(--wesal-maroon)_16%,#edd9d1)] bg-[linear-gradient(135deg,#fffdfb_0%,#faf1ec_45%,#f6e8e1_100%)] px-3.5 py-3.5 shadow-[0_10px_26px_rgba(120,70,60,0.08)] sm:px-5 sm:py-4">
              <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(226,201,138,0.75),transparent)]" />
                <div className="owner-add-hall-banner-blob absolute -start-10 -top-12 h-36 w-44 rounded-full bg-[radial-gradient(circle,rgba(193,123,127,0.22),transparent_68%)] blur-[1px]" />
                <div className="owner-add-hall-banner-blob-delay absolute -bottom-14 end-0 h-40 w-48 rounded-full bg-[radial-gradient(circle,rgba(196,160,92,0.2),transparent_70%)]" />
                <div className="absolute start-1/3 top-0 h-20 w-40 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.7),transparent_70%)]" />
                <div className="owner-add-hall-banner-sheen" />
                <LeafBranch className="owner-add-hall-banner-leaf absolute end-3 top-1/2 hidden h-[4.5rem] w-14 -translate-y-1/2 text-[var(--wesal-gold)]/45 sm:block" />
              </div>
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                <div className="flex min-w-0 items-center gap-3.5">
                  <span className="owner-add-hall-banner-icon relative inline-flex h-14 w-14 shrink-0 items-center justify-center">
                    <AddHallIcon />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-[0.95rem] font-extrabold leading-6 text-[var(--wesal-maroon-dark)] sm:text-base">
                      {t("owner.hallsPage.addBannerTitle")}
                    </h2>
                    <span className="mt-1.5 block h-0.5 w-12 rounded-full bg-[linear-gradient(90deg,var(--wesal-gold-soft),var(--wesal-maroon),transparent)]" />
                    <p className="mt-1.5 text-xs leading-5 text-[var(--wesal-muted)] sm:text-[13px] sm:leading-6">
                      {t("owner.hallsPage.addBannerBody")}
                    </p>
                  </div>
                </div>
                <div className="flex w-full items-center px-1 sm:w-auto sm:shrink-0 sm:gap-3.5 sm:px-0">
                  <span className="hidden h-12 w-px bg-[linear-gradient(180deg,transparent,#e0c7be,transparent)] sm:block" aria-hidden="true" />
                  <button
                    type="button"
                    className="btn-primary min-h-9 w-full justify-center rounded-full px-3 text-center text-[0.72rem] shadow-[0_10px_22px_rgba(168,98,103,0.28)] sm:min-h-11 sm:w-auto sm:px-6 sm:text-sm"
                    disabled={isInitiating}
                    onClick={beginAddHall}
                  >
                    {isInitiating ? (
                      t("owner.management.addHall.starting")
                    ) : (
                      <span className="inline-flex items-center justify-center gap-1.5">
                        <span>{t("owner.hallsPage.addBannerCta")}</span>
                        <span
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[13px] font-bold"
                          aria-hidden="true"
                        >
                          +
                        </span>
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}

function hallPhotoUrls(details?: HallOwnerHallDetails): string[] {
  if (!details) return [];
  const urls: string[] = [];
  if (details.mainImageUrl) urls.push(details.mainImageUrl);
  for (const photo of details.photos) {
    if (photo.url && !urls.includes(photo.url)) urls.push(photo.url);
  }
  return urls;
}

function OwnerHallCard({
  hall,
  details,
  index = 0,
}: {
  hall: HallOwnerHall;
  details?: HallOwnerHallDetails;
  index?: number;
}) {
  const t = useT();
  const lang = useUiLang();
  const lane = hallLane(hall);
  const name = localizeHallName(hall.id, details?.name || hall.name, lang);
  const regionLabel =
    details?.region && isHallRegion(details.region)
      ? t(HALL_REGION_LABEL_KEYS[details.region])
      : "";
  const location = [regionLabel, details?.address].filter(Boolean).join(" - ");
  const locked = hall.adminLocked;
  const photos = hallPhotoUrls(details);
  const showSubscription =
    hall.status === "Approved" && (hall.paymentStatus === "Paid" || hall.systemLocked);
  const badgeKey =
    lane === "available"
      ? "owner.hallsPage.badge.available"
      : hall.status === "Approved" && hall.paymentStatus !== "Paid"
        ? "owner.hallsPage.badge.payment"
        : lane === "review"
          ? "owner.hallsPage.badge.review"
          : "owner.hallsPage.badge.unavailable";
  const badgeClass =
    lane === "available"
      ? "bg-[#e7f6ee] text-[#047857]"
      : lane === "review"
        ? "bg-[#fff4e5] text-[#9a5b12]"
        : "bg-[#fdecec] text-[#b42318]";
  const dotClass =
    lane === "available" ? "bg-[#12b76a]" : lane === "review" ? "bg-[#f5a524]" : "bg-[#b42318]";

  return (
    <li
      className="owner-hall-card overflow-hidden rounded-[1.15rem] border border-[color-mix(in_srgb,var(--wesal-maroon)_18%,var(--wesal-border))] bg-white shadow-[0_8px_22px_rgba(90,55,45,0.05)]"
      style={{ animationDelay: `${Math.min(index, 6) * 70}ms` }}
    >
      <div className="flex flex-col md:flex-row">
        <HallCardPhotos images={photos} emptyLabel={t("owner.hallsPage.title")} />
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-2.5 sm:p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-extrabold text-[var(--wesal-maroon-dark)]">{name}</h2>
              {location ? (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--wesal-muted)]">
                  <PinIcon />
                  <span className="truncate">{location}</span>
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badgeClass}`}>
                <span className={`owner-hall-card-dot h-1.5 w-1.5 rounded-full ${dotClass}`} />
                {t(badgeKey)}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full bg-[var(--wesal-pink)] px-2 py-0.5 text-[11px] font-bold text-[var(--wesal-text)]"
                aria-label={
                  details?.rating != null && Number.isFinite(details.rating)
                    ? t("halls.details.ratingAria", {
                        rating: Number(details.rating).toFixed(1),
                      })
                    : t("halls.details.ratingLabel")
                }
                data-testid="owner-hall-card-rating"
              >
                <GoldStar size={12} />
                <span>
                  {details?.rating != null && Number.isFinite(details.rating)
                    ? Number(details.rating).toFixed(1)
                    : "—"}
                </span>
                {details?.reviewCount != null && details.reviewCount > 0 ? (
                  <span className="font-medium text-[var(--wesal-muted)]">
                    ({details.reviewCount})
                  </span>
                ) : null}
              </span>
            </div>
          </div>

          <dl className="grid w-full grid-cols-2 gap-1.5 px-1">
            <SubscriptionStat
              hallId={showSubscription ? hall.id : null}
              ended={hall.systemLocked}
              fallbackDays={hall.daysRemaining}
            />
            <StatTile
              icon={<PeopleIcon />}
              label={t("owner.hallsPage.capacity")}
              value={
                details && details.capacity > 0
                  ? t("owner.hallsPage.guests", { count: details.capacity })
                  : "—"
              }
            />
            <StatTile
              className="col-span-2"
              icon={<ShekelIcon />}
              label={t("owner.hallsPage.priceFrom")}
              value={
                details?.showPrice && details.price != null && details.price > 0
                  ? `${details.price.toLocaleString("en-US")} ₪`
                  : "—"
              }
              valueClass="text-[var(--wesal-maroon-dark)]"
            />
          </dl>

          <div className="grid w-full grid-cols-2 gap-1.5 px-1">
            <HallAction
              href={locked ? undefined : ownerHallPath(hall.id)}
              label={t("owner.hallsPage.editData")}
              icon={<PencilIcon />}
            />
            <HallAction
              href={locked ? undefined : `${HALL_OWNER_CALENDAR_PATH}?hall=${encodeURIComponent(hall.id)}`}
              label={t("owner.hallsPage.availability")}
              icon={<CalendarIcon />}
            />
            {locked ? null : (
              <HallAction
                href={ownerHallNotificationsPath(hall.id)}
                label={t("owner.hallsPage.requests")}
                icon={<ChatIcon />}
              />
            )}
            <HallAction
              href={ownerHallViewPath(hall.id)}
              label={t("owner.hallsPage.viewHall")}
              icon={<ArrowIcon />}
              primary
              className={locked ? "col-span-2" : ""}
            />
          </div>

          {hall.status === "Rejected" && !locked ? (
            <HallRejectionReasonNotice hallId={hall.id} rejected />
          ) : null}
          {locked ? <OwnerHallAdminLockedNotice /> : null}
        </div>
      </div>
    </li>
  );
}

function HallCardPhotos({ images, emptyLabel }: { images: string[]; emptyLabel: string }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const count = images.length;
  const current = count > 0 ? images[index % count] : "";

  function step(delta: number) {
    if (count < 2) return;
    setIndex((value) => (value + delta + count) % count);
  }

  return (
    <div className="relative min-h-44 w-full shrink-0 bg-[var(--wesal-pink-soft)] md:w-64">
      {current ? (
        <img src={current} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="flex min-h-44 items-center justify-center px-4 text-xs text-[var(--wesal-muted)]">
          {emptyLabel}
        </div>
      )}
      {count > 0 ? (
        <span className="absolute end-2.5 top-2.5 inline-flex items-center gap-1 rounded-md bg-black/45 px-1.5 py-0.5 text-[11px] font-bold text-white">
          <ImageIcon />
          {count}
        </span>
      ) : null}
      {count > 1 ? (
        <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white"
            aria-label={t("owner.hallsPage.prevPhoto")}
            onClick={() => step(-1)}
          >
            <Chevron dir="right" />
          </button>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white"
            aria-label={t("owner.hallsPage.nextPhoto")}
            onClick={() => step(1)}
          >
            <Chevron dir="left" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SubscriptionStat({
  hallId,
  ended,
  fallbackDays,
}: {
  hallId: string | null;
  ended: boolean;
  fallbackDays?: number | null;
}) {
  const t = useT();
  const { status, subscription } = useSubscription(ended ? null : hallId, !ended && hallId != null);
  let value = "—";
  let valueClass = "text-[#047857]";
  let tone: "default" | "success" | "danger" = "success";
  if (ended) {
    value = t("owner.subscription.hallsExpiredNote");
    valueClass = "text-[#b42318]";
    tone = "danger";
  } else if (status === "ready" && subscription) {
    const days = subscription.daysRemaining;
    const finished = subscription.status === "expired" || (days != null && days <= 0);
    if (finished) {
      value = t("owner.subscription.hallsExpiredNote");
      valueClass = "text-[#b42318]";
      tone = "danger";
    } else if (days != null) {
      value = t("owner.hallsPage.days", { count: days });
    } else if (fallbackDays != null && fallbackDays > 0) {
      value = t("owner.hallsPage.days", { count: fallbackDays });
    }
  } else if (fallbackDays != null && fallbackDays > 0) {
    value = t("owner.hallsPage.days", { count: fallbackDays });
  }
  return (
    <StatTile
      icon={<CalendarIcon />}
      label={t("owner.hallsPage.subscriptionLeft")}
      value={value}
      valueClass={valueClass}
      tone={tone}
      testId={ended || valueClass.includes("b42318") ? "hall-subscription-ended-note" : "hall-subscription-days-note"}
    />
  );
}

function StatTile({
  icon,
  label,
  value,
  valueClass = "text-[var(--wesal-text)]",
  tone = "default",
  testId,
  className = "",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueClass?: string;
  tone?: "default" | "success" | "danger";
  testId?: string;
  className?: string;
}) {
  const shellClass =
    tone === "success"
      ? "bg-[#e7f6ee]"
      : tone === "danger"
        ? "bg-[#fdecec]"
        : "bg-[#fbf4f1]";
  const iconClass =
    tone === "success"
      ? "text-[#047857]"
      : tone === "danger"
        ? "text-[#b42318]"
        : "text-[var(--wesal-maroon)]";
  const labelClass =
    tone === "success"
      ? "text-[#067647]/80"
      : tone === "danger"
        ? "text-[#b42318]/75"
        : "text-[var(--wesal-muted)]";

  return (
    <div className={`flex min-h-0 w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-center ${shellClass} ${className}`}>
      <span className={iconClass}>{icon}</span>
      <div className="min-w-0">
        <p className={`text-[0.65rem] leading-tight ${labelClass}`}>{label}</p>
        <p className={`text-xs font-extrabold leading-tight ${valueClass}`} data-testid={testId}>
          {value}
        </p>
      </div>
    </div>
  );
}

function HallAction({
  href,
  label,
  icon,
  primary = false,
  className = "",
}: {
  href?: string;
  label: string;
  icon: ReactNode;
  primary?: boolean;
  className?: string;
}) {
  const classes = `inline-flex min-h-8 w-full min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-1 text-center text-[0.68rem] font-bold ${
    primary
      ? "bg-[var(--wesal-maroon)] text-white"
      : "bg-[#f7eee9] text-[var(--wesal-maroon-dark)]"
  } ${href ? "" : "pointer-events-none opacity-50"} ${className}`;
  if (!href) {
    return (
      <span className={classes} aria-disabled="true">
        <span>{label}</span>
        {icon}
      </span>
    );
  }
  return (
    <Link href={href} className={classes} prefetch>
      <span>{label}</span>
      {icon}
    </Link>
  );
}

function AddHallIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14 drop-shadow-sm" aria-hidden="true">
      <defs>
        <radialGradient id="addHallGlow" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#f7e7e4" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="addHallRoof" x1="16" y1="16" x2="48" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#d49a9d" />
          <stop offset="100%" stopColor="#c17b7f" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="#f6e6e3" />
      <circle cx="32" cy="32" r="30" fill="url(#addHallGlow)" />
      <path d="M20 30h24v15.5c0 1.4-1.1 2.5-2.5 2.5h-19c-1.4 0-2.5-1.1-2.5-2.5V30Z" fill="#fdf7f5" />
      <path d="M17 30.8 32 16.2 47 30.8c-1.2-.7-3.4-1.3-15-1.3s-13.8.6-15 1.3Z" fill="url(#addHallRoof)" />
      <path d="M20 45.2h24" stroke="#c9898d" strokeWidth="3" strokeLinecap="round" />
      <path d="M28.6 34.2h6.8a2.2 2.2 0 0 1 2.2 2.2V47h-11.2v-10.6a2.2 2.2 0 0 1 2.2-2.2Z" fill="#a86267" />
      <path d="M22.2 34.4h5v5.6a1.7 1.7 0 0 1-1.7 1.7h-1.6a1.7 1.7 0 0 1-1.7-1.7v-5.6Z" fill="#b8757a" />
      <path d="M36.8 34.4h5v5.6a1.7 1.7 0 0 1-1.7 1.7h-1.6a1.7 1.7 0 0 1-1.7-1.7v-5.6Z" fill="#b8757a" />
      <g className="owner-add-hall-banner-plus">
        <circle cx="45.2" cy="18.8" r="8" fill="#8a3d48" />
        <path d="M45.2 15.2v7.2M41.6 18.8h7.2" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function LeafBranch({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 72" className={className} fill="none" aria-hidden="true">
      <path d="M20 66c2-18-2-30-10-44" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M11 24c5-1.5 10 2.5 11 7.5-5 1.5-10-2.5-11-7.5ZM15 36c5 0 10 3.5 10 8.5-5 0-10-3.5-10-8.5ZM19 48c4.5.5 8 4 7.5 8.5-4.5-.5-8-4-7.5-8.5Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M22 58c3-8 11-13 18-14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path
        d="M36 40c4 2.5 5.5 7.5 3 11.5-4-2.5-5.5-7.5-3-11.5ZM41 48c3.5 2.5 4.5 7 2 10.5-3.5-2.5-4.5-7-2-10.5Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
      <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 19c.8-2.8 2.8-4 5.5-4s4.7 1.2 5.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ShekelIcon() {
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center font-['Segoe_UI','Arial',sans-serif] text-[15px] font-bold leading-none"
      aria-hidden="true"
    >
      ₪
    </span>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="10" r="1.4" fill="currentColor" />
      <path d="M7 16l3.2-3.2 2.2 2.2L16 11l3 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12.5 7.5l4 4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path d="M6 16.5 4 20l4-1.5A8 8 0 1 0 6 16.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path d="M14 6 8 12l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d={dir === "left" ? "M14 6 8 12l6 6" : "M10 6l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-8 w-full min-w-0 items-center justify-center truncate rounded-full px-1.5 py-1 text-center text-[0.68rem] font-bold leading-tight sm:min-h-0 sm:w-auto sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
        active
          ? "bg-[var(--wesal-maroon)] text-white"
          : "border border-[color-mix(in_srgb,var(--wesal-maroon)_18%,var(--wesal-border))] bg-white text-[var(--wesal-text)]"
      }`}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
