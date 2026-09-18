"use client";

import Link from "next/link";
import { useMemo } from "react";
import HallApprovalStatusBadge from "@/components/owner-management/halls/HallApprovalStatusBadge";
import SubscriptionExpiryWarningBanner from "@/components/halls/subscription/SubscriptionExpiryWarningBanner";
import { useUiLang } from "@/components/layout/LanguageProvider";
import {
  OWNER_ACCOUNT_PATH,
  OWNER_HALLS_PATH,
} from "@/constants/hallOwnerManagementNav";
import { useAddHallInitiation } from "@/hooks/useAddHallInitiation";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import { useHallOwnerManagementProfile } from "@/hooks/useHallOwnerManagementProfile";
import { ownerHallPath } from "@/lib/hall-owner-query-keys";
import { localizeHallName } from "@/lib/localize-hall-display";
import { useT } from "@/i18n";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "و";
}

export default function OwnerDashboardHome() {
  const t = useT();
  const lang = useUiLang();
  const profileState = useHallOwnerManagementProfile();
  const hallsState = useHallOwnerHalls();
  const { startAddHall, isInitiating } = useAddHallInitiation();

  const stats = useMemo(() => {
    const list = hallsState.halls;
    return {
      total: list.length,
      pending: list.filter((item) => item.status === "Pending").length,
      approved: list.filter((item) => item.status === "Approved").length,
      rejected: list.filter((item) => item.status === "Rejected").length,
    };
  }, [hallsState.halls]);

  const pendingHalls =
    hallsState.status === "ready" || hallsState.halls.length > 0
      ? hallsState.halls.filter((item) => item.status === "Pending")
      : [];

  const expiryWarnings =
    hallsState.status === "ready" || hallsState.halls.length > 0
      ? hallsState.halls.filter((item) => item.expiryWarning)
      : [];

  const recentHalls =
    hallsState.status === "ready" || hallsState.halls.length > 0
      ? hallsState.halls.slice(0, 4)
      : [];

  if (!profileState.authReady) {
    return (
      <div
        className="h-72 animate-pulse rounded-[1.4rem] bg-white/80"
        aria-busy="true"
        data-testid="owner-dashboard-loading"
      />
    );
  }

  if (profileState.status === "error" && !profileState.profile) {
    return (
      <section className="rounded-2xl bg-white p-6" data-testid="owner-dashboard-error">
        <h1 className="text-2xl font-bold text-[var(--wesal-maroon)]">
          {t("owner.appTitle")}
        </h1>
        <p className="mt-3 text-sm text-[var(--wesal-muted)]">
          {t(profileState.loadError ?? "owner.management.loadError")}
        </p>
        <button type="button" className="btn-outline mt-5" onClick={() => void profileState.reload()}>
          {t("common.retry")}
        </button>
      </section>
    );
  }

  const name = profileState.profile?.fullName || t("owner.guestName");

  return (
    <div className="seeker-home" data-testid="owner-dashboard-home">
      <section className="seeker-welcome">
        <div className="seeker-welcome-copy">
          <h1 className="seeker-welcome-title">
            {t("owner.welcomeBack", { name })}
          </h1>
          <p className="seeker-welcome-body">{t("owner.welcomeSubtitle")}</p>
          <div className="seeker-welcome-actions">
            <Link href={OWNER_HALLS_PATH} className="seeker-btn-primary" prefetch>
              {t("owner.cta.halls")}
            </Link>
            <button
              type="button"
              className="seeker-btn-secondary"
              disabled={isInitiating}
              aria-busy={isInitiating || undefined}
              data-testid="owner-home-add-hall"
              onClick={() => {
                if (!isInitiating) void startAddHall();
              }}
            >
              {isInitiating ? t("owner.management.addHall.starting") : t("owner.cta.addHall")}
              <ArrowIcon />
            </button>
          </div>
        </div>

        <div className="seeker-welcome-visual" aria-hidden="true">
          <div className="seeker-welcome-orb">
            <span>{initials(name)}</span>
          </div>
          <Link href={OWNER_ACCOUNT_PATH} className="seeker-welcome-badge" prefetch>
            {t("owner.myAccount")}
          </Link>
        </div>
      </section>

      {expiryWarnings.length > 0 ? (
        <section
          className="space-y-3"
          aria-label={t("owner.subscription.expiryWarning.section")}
          data-testid="owner-dashboard-expiry-warnings"
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

      <section className="seeker-summary" aria-labelledby="owner-summary-heading">
        <h2 id="owner-summary-heading" className="seeker-home-section-title">
          {t("owner.summaryTitle")}
        </h2>
        <ul className="seeker-summary-grid">
          <li className="seeker-summary-card">
            <span className="seeker-summary-icon seeker-summary-icon--total" aria-hidden="true">
              <BuildingIcon />
            </span>
            <p className="seeker-summary-value">
              {hallsState.isLoading && hallsState.halls.length === 0 ? "—" : stats.total}
            </p>
            <p className="seeker-summary-label">{t("owner.stats.total")}</p>
          </li>
          <li className="seeker-summary-card">
            <span className="seeker-summary-icon seeker-summary-icon--pending" aria-hidden="true">
              <ClockIcon />
            </span>
            <p className="seeker-summary-value">
              {hallsState.isLoading && hallsState.halls.length === 0 ? "—" : stats.pending}
            </p>
            <p className="seeker-summary-label">{t("owner.stats.pending")}</p>
          </li>
          <li className="seeker-summary-card">
            <span className="seeker-summary-icon seeker-summary-icon--ok" aria-hidden="true">
              <CheckIcon />
            </span>
            <p className="seeker-summary-value">
              {hallsState.isLoading && hallsState.halls.length === 0 ? "—" : stats.approved}
            </p>
            <p className="seeker-summary-label">{t("owner.stats.approved")}</p>
          </li>
          <li className="seeker-summary-card">
            <span className="seeker-summary-icon seeker-summary-icon--bad" aria-hidden="true">
              <CloseIcon />
            </span>
            <p className="seeker-summary-value">
              {hallsState.isLoading && hallsState.halls.length === 0 ? "—" : stats.rejected}
            </p>
            <p className="seeker-summary-label">{t("owner.stats.rejected")}</p>
          </li>
        </ul>
      </section>

      <section className="seeker-pending-panel">
        <div className="seeker-pending-head">
          <h2 className="seeker-home-section-title seeker-home-section-title--inline">
            {pendingHalls.length > 0
              ? t("owner.pendingTitle")
              : t("owner.hallsPreviewTitle")}
          </h2>
          <Link href={OWNER_HALLS_PATH} className="seeker-home-view-all" prefetch>
            {t("owner.viewAll")}
            <ArrowIcon />
          </Link>
        </div>

        {hallsState.isLoading && hallsState.halls.length === 0 ? (
          <div
            className="h-28 animate-pulse rounded-2xl bg-[var(--wesal-pink-soft)]"
            aria-busy="true"
          />
        ) : pendingHalls.length > 0 ? (
          <ul className="seeker-home-booking-list">
            {pendingHalls.slice(0, 4).map((hall) => (
              <li key={hall.id}>
                <Link
                  href={ownerHallPath(hall.id)}
                  className="seeker-home-booking-row block"
                  prefetch
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-[var(--wesal-text)]">
                      {localizeHallName(hall.id, hall.name, lang)}
                    </p>
                    <HallApprovalStatusBadge status={hall.status} />
                  </div>
                  <p className="text-sm text-[var(--wesal-muted)]">
                    {t("owner.pendingHallHint")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : recentHalls.length > 0 ? (
          <ul className="seeker-home-booking-list">
            {recentHalls.map((hall) => (
              <li key={hall.id}>
                <Link
                  href={ownerHallPath(hall.id)}
                  className="seeker-home-booking-row block"
                  prefetch
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-[var(--wesal-text)]">
                      {localizeHallName(hall.id, hall.name, lang)}
                    </p>
                    <HallApprovalStatusBadge status={hall.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="seeker-pending-empty" data-testid="owner-home-empty">
            <p>{t("owner.hallsEmpty")}</p>
            <button
              type="button"
              className="seeker-home-soft-btn"
              disabled={isInitiating}
              onClick={() => {
                if (!isInitiating) void startAddHall();
              }}
            >
              {t("owner.cta.addHall")}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M14 6l6 6-6 6M20 12H4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8v4l2.5 1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="m6.5 12.5 3.2 3.2 7.8-7.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M4 20V8.5L12 4l8 4.5V20"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
