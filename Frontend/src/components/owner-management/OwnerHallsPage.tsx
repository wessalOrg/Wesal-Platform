"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import OwnerPaidSubscriptionDays from "@/components/halls/subscription/OwnerPaidSubscriptionDays";
import HallRejectionReasonNotice from "@/components/owner-management/halls/HallRejectionReasonNotice";
import OwnerHallAdminLockedNotice from "@/components/halls/OwnerHallAdminLockedNotice";
import SubscriptionExpiryWarningBanner from "@/components/halls/subscription/SubscriptionExpiryWarningBanner";
import SubscriptionPaymentNotice from "@/components/halls/subscription/SubscriptionPaymentNotice";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { HALL_REGION_LABEL_KEYS, isHallRegion } from "@/constants/hallRegions";
import { useAddHallInitiation } from "@/hooks/useAddHallInitiation";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import { HALL_OWNER_CALENDAR_PATH } from "@/lib/account-profile-path";
import {
  ownerHallNotificationsPath,
  ownerHallPath,
} from "@/lib/hall-owner-query-keys";
import { localizeHallName } from "@/lib/localize-hall-display";
import { fetchOwnerHallDetails } from "@/services/hall-owner-hall-management";
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

function isPublicHall(hall: HallOwnerHall): boolean {
  return hallLane(hall) === "available";
}

export default function OwnerHallsPage() {
  const t = useT();
  const lang = useUiLang();
  const { halls, isLoading, status, errorKey, refetch, isRefreshing } =
    useHallOwnerHalls();
  const { startAddHall, isInitiating } = useAddHallInitiation();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HallFilter>("all");
  const [grid, setGrid] = useState(true);
  const [detailsById, setDetailsById] = useState<Record<string, HallOwnerHallDetails>>({});

  const hallIds = halls.map((hall) => hall.id).join("|");

  useEffect(() => {
    const ids = hallIds ? hallIds.split("|") : [];
    if (ids.length === 0) return;
    let cancelled = false;
    void Promise.all(
      ids.map(async (id) => {
        try {
          return [id, await fetchOwnerHallDetails(id)] as const;
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
      <section className="relative overflow-hidden rounded-[28px] border border-[var(--wesal-border)] bg-[linear-gradient(145deg,#fffaf7_0%,#f8efe9_48%,#f3e4dc_100%)] px-5 pb-16 pt-7 sm:px-8 sm:pb-20 sm:pt-8">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-16 end-[-2rem] h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(196,160,92,0.34),transparent_68%)]" />
          <div className="absolute top-6 start-1/3 h-36 w-56 rounded-full bg-[radial-gradient(circle,rgba(193,123,127,0.18),transparent_70%)]" />
          <svg
            className="absolute inset-x-0 bottom-0 h-24 w-full sm:h-28"
            viewBox="0 0 1440 140"
            preserveAspectRatio="none"
          >
            <path
              fill="rgba(193,123,127,0.28)"
              d="M0 78C180 118 340 28 540 52C760 78 900 18 1100 46C1260 66 1360 40 1440 58V140H0Z"
            />
            <path
              fill="rgba(196,160,92,0.36)"
              d="M0 104C220 62 420 124 680 96C940 68 1120 118 1440 86V140H0Z"
            />
            <path
              fill="rgba(255,250,247,0.55)"
              d="M0 118C260 92 520 132 780 112C1040 92 1240 128 1440 108V140H0Z"
            />
          </svg>
        </div>
        <div className="relative max-w-2xl">
          <h1 className="text-3xl font-extrabold text-[var(--wesal-maroon-dark)] sm:text-4xl">
            {t("owner.hallsPage.title")}
          </h1>
          <span className="mt-3 block h-1 w-16 rounded-full bg-[linear-gradient(90deg,var(--wesal-gold-soft),var(--wesal-maroon),var(--wesal-gold))]" />
          <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--wesal-text)]">
            {t("owner.hallsPage.subtitle")}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/halls" className="btn-outline min-h-11 rounded-full bg-white/80 px-5" prefetch>
              {t("owner.hallsPage.explore")}
            </Link>
            <button
              type="button"
              className="btn-primary min-h-11 rounded-full px-5"
              disabled={isInitiating}
              aria-busy={isInitiating || undefined}
              onClick={beginAddHall}
            >
              {isInitiating
                ? t("owner.management.addHall.starting")
                : `+ ${t("owner.hallsPage.addNew")}`}
            </button>
          </div>
        </div>
      </section>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("owner.hallsPage.stat.total")} value={counts.total} />
        <StatCard label={t("owner.hallsPage.stat.available")} value={counts.available} />
        <StatCard label={t("owner.hallsPage.stat.review")} value={counts.review} />
        <StatCard label={t("owner.hallsPage.stat.unavailable")} value={counts.unavailable} />
      </ul>

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
          <div className="flex flex-col gap-3 rounded-[24px] border border-[var(--wesal-border)] bg-white p-3 sm:flex-row sm:items-center">
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${grid ? "bg-[var(--wesal-pink)] text-[var(--wesal-maroon)]" : "text-[var(--wesal-muted)]"}`}
                aria-pressed={grid}
                aria-label={t("owner.hallsPage.viewGrid")}
                onClick={() => setGrid(true)}
              >
                <GridIcon />
              </button>
              <button
                type="button"
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${grid ? "text-[var(--wesal-muted)]" : "bg-[var(--wesal-pink)] text-[var(--wesal-maroon)]"}`}
                aria-pressed={!grid}
                aria-label={t("owner.hallsPage.viewList")}
                onClick={() => setGrid(false)}
              >
                <ListIcon />
              </button>
            </div>
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">{t("owner.hallsPage.search")}</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("owner.hallsPage.search")}
                className="h-11 w-full rounded-xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 text-sm text-[var(--wesal-text)] outline-none focus:border-[var(--wesal-maroon)]"
              />
            </label>
            <div className="flex flex-wrap gap-2">
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
            <ul
              className={grid ? "grid gap-4 lg:grid-cols-2" : "grid gap-4"}
              data-testid="owner-halls-page-list"
            >
              {visibleHalls.map((hall) => (
                <OwnerHallCard
                  key={hall.id}
                  hall={hall}
                  details={detailsById[hall.id]}
                  list={!grid}
                />
              ))}
            </ul>
          )}

          <section className="flex flex-col items-start justify-between gap-4 rounded-[24px] border border-[var(--wesal-border)] bg-white px-5 py-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold text-[var(--wesal-text)]">
                {t("owner.hallsPage.addBannerTitle")}
              </h2>
              <p className="mt-1 text-sm text-[var(--wesal-muted)]">
                {t("owner.hallsPage.addBannerBody")}
              </p>
            </div>
            <button
              type="button"
              className="btn-primary min-h-11 rounded-full"
              disabled={isInitiating}
              onClick={beginAddHall}
            >
              {`+ ${t("owner.hallsPage.addBannerCta")}`}
            </button>
          </section>
        </>
      ) : null}
    </div>
  );
}

function OwnerHallCard({
  hall,
  details,
  list,
}: {
  hall: HallOwnerHall;
  details?: HallOwnerHallDetails;
  list: boolean;
}) {
  const t = useT();
  const lang = useUiLang();
  const lane = hallLane(hall);
  const name = localizeHallName(hall.id, details?.name || hall.name, lang);
  const regionLabel =
    details?.region && isHallRegion(details.region)
      ? t(HALL_REGION_LABEL_KEYS[details.region])
      : "";
  const location = [regionLabel, details?.address].filter(Boolean).join(" · ");
  const cover = details?.mainImageUrl || details?.photos[0]?.url || "";
  const locked = hall.adminLocked;
  const badgeKey =
    lane === "available"
      ? "owner.hallsPage.badge.available"
      : hall.status === "Approved" && hall.paymentStatus !== "Paid"
        ? "owner.hallsPage.badge.payment"
        : lane === "review"
          ? "owner.hallsPage.badge.review"
          : "owner.hallsPage.badge.unavailable";

  return (
    <li className="overflow-hidden rounded-[24px] border border-[var(--wesal-border)] bg-white">
      <div className={list ? "sm:flex" : ""}>
        <div className={`relative bg-[var(--wesal-pink-soft)] ${list ? "sm:w-64 sm:shrink-0" : "h-48"}`}>
          {cover ? (
            <img src={cover} alt="" className={`h-full w-full object-cover ${list ? "h-48 sm:h-full" : "h-48"}`} />
          ) : (
            <div className="flex h-48 items-center justify-center text-[var(--wesal-muted)]">
              {t("owner.hallsPage.title")}
            </div>
          )}
          <span
            className={`absolute start-3 top-3 rounded-full px-3 py-1 text-xs font-bold ${
              lane === "available"
                ? "bg-[#e8f6ee] text-[#047857]"
                : lane === "review"
                  ? "bg-[#fff4e5] text-[#9a5b12]"
                  : "bg-[#fdecec] text-[#b42318]"
            }`}
          >
            {t(badgeKey)}
          </span>
        </div>
        <div className="min-w-0 flex-1 p-4">
          <h2 className="truncate text-lg font-extrabold text-[var(--wesal-text)]">{name}</h2>
          {location ? <p className="mt-1 text-sm text-[var(--wesal-muted)]">{location}</p> : null}
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-[var(--wesal-muted)]">{t("owner.hallsPage.capacity")}</dt>
              <dd className="font-bold text-[var(--wesal-text)]">
                {details && details.capacity > 0
                  ? t("owner.hallsPage.guests", { count: details.capacity })
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--wesal-muted)]">{t("owner.hallsPage.priceFrom")}</dt>
              <dd className="font-bold text-[var(--wesal-text)]">
                {details?.showPrice && details.price != null && details.price > 0
                  ? `${details.price.toLocaleString("en-US")} ₪`
                  : "—"}
              </dd>
            </div>
          </dl>
          {hall.status === "Approved" && (hall.paymentStatus === "Paid" || hall.systemLocked) ? (
            <div className="mt-3">
              <OwnerPaidSubscriptionDays hallId={hall.id} ended={hall.systemLocked} />
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {isPublicHall(hall) ? (
              <Link href={`/halls/${encodeURIComponent(hall.id)}`} className="seeker-home-soft-btn" prefetch>
                {t("owner.hallsPage.viewHall")}
              </Link>
            ) : (
              <span className="seeker-home-soft-btn pointer-events-none opacity-50" aria-disabled="true">
                {t("owner.hallsPage.viewHall")}
              </span>
            )}
            {locked ? (
              <span className="seeker-home-soft-btn pointer-events-none opacity-50" aria-disabled="true">
                {t("owner.hallsPage.editData")}
              </span>
            ) : (
              <Link href={ownerHallPath(hall.id)} className="btn-primary min-h-10 rounded-full px-4 text-xs" prefetch>
                {t("owner.hallsPage.editData")}
              </Link>
            )}
            {locked ? (
              <span className="seeker-home-soft-btn pointer-events-none opacity-50" aria-disabled="true">
                {t("owner.hallsPage.availability")}
              </span>
            ) : (
              <Link
                href={`${HALL_OWNER_CALENDAR_PATH}?hall=${encodeURIComponent(hall.id)}`}
                className="seeker-home-soft-btn"
                prefetch
              >
                {t("owner.hallsPage.availability")}
              </Link>
            )}
            {locked ? null : (
              <Link href={ownerHallNotificationsPath(hall.id)} className="seeker-home-soft-btn" prefetch>
                {t("owner.hallsPage.requests")}
              </Link>
            )}
          </div>
          {hall.status === "Rejected" && !locked ? (
            <div className="mt-3">
              <HallRejectionReasonNotice hallId={hall.id} rejected />
            </div>
          ) : null}
          {locked ? (
            <div className="mt-3">
              <OwnerHallAdminLockedNotice />
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <li className="rounded-[22px] border border-[var(--wesal-border)] bg-white px-4 py-4">
      <p className="text-sm text-[var(--wesal-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-[var(--wesal-maroon-dark)]">{value}</p>
    </li>
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
      className={`rounded-full px-3 py-2 text-xs font-bold ${
        active
          ? "bg-[var(--wesal-maroon)] text-white"
          : "border border-[var(--wesal-border)] bg-white text-[var(--wesal-text)]"
      }`}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="4" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="4" y="14" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="14" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
