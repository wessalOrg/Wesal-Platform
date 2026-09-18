"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUserBookings } from "@/hooks/useUserBookings";
import {
  SEEKER_ACCOUNT_PATH,
  SEEKER_BOOKINGS_PATH,
} from "@/constants/seekerDashboardNav";
import { useT } from "@/i18n";
import { isPendingCancelGroup } from "@/lib/booking-cancel-ui";
import { localizeHallName } from "@/lib/localize-hall-display";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "و";
}

export default function SeekerDashboardHome() {
  const t = useT();
  const lang = useUiLang();
  const identity = useUserIdentity();
  const profileState = useUserProfile();
  const bookingsState = useUserBookings();

  const stats = useMemo(() => {
    const list = bookingsState.bookings;
    const pending = list.filter((item) => item.status === "Pending").length;
    const accepted = list.filter((item) => item.status === "Accepted").length;
    const rejected = list.filter((item) => item.status === "Rejected").length;
    return {
      total: list.length,
      pending,
      accepted,
      rejected,
    };
  }, [bookingsState.bookings]);

  const pendingBookings =
    bookingsState.status === "ready" || bookingsState.bookings.length > 0
      ? bookingsState.bookings.filter((item) =>
          isPendingCancelGroup(item.status, bookingsState.isCancelLocked(item.bookingId)),
        )
      : [];

  // Guard already authenticated the seeker — paint immediately with session name.
  if (profileState.status === "unauthorized") {
    return (
      <section className="rounded-2xl bg-white p-6" data-testid="seeker-dashboard-unauthorized">
        <h1 className="text-2xl font-bold text-[var(--wesal-maroon)]">{t("seeker.title")}</h1>
        <p className="mt-3 text-sm text-[var(--wesal-muted)]">{t("profile.loginRequired")}</p>
        <Link href="/login?redirect=/profile" className="btn-primary mt-5">
          {t("profile.goLogin")}
        </Link>
      </section>
    );
  }

  if (profileState.status === "error" && !profileState.profile && !identity.displayName) {
    return (
      <section className="rounded-2xl bg-white p-6" data-testid="seeker-dashboard-error">
        <h1 className="text-2xl font-bold text-[var(--wesal-maroon)]">{t("seeker.title")}</h1>
        <p className="mt-3 text-sm text-[var(--wesal-muted)]">{t("errors.profile.load")}</p>
        <button type="button" className="btn-outline mt-5" onClick={profileState.reload}>
          {t("common.retry")}
        </button>
      </section>
    );
  }

  const name =
    profileState.profile?.fullName ||
    identity.displayName ||
    t("seeker.guestName");
  const statsPending = bookingsState.status === "loading" && bookingsState.bookings.length === 0;

  return (
    <div className="seeker-home" data-testid="seeker-dashboard-home">
      <section className="seeker-welcome">
        <div className="seeker-welcome-copy">
          <h1 className="seeker-welcome-title">
            {t("seeker.welcomeBack", { name })}
          </h1>
          <p className="seeker-welcome-body">{t("seeker.welcomeSubtitle")}</p>
          <div className="seeker-welcome-actions">
            <Link href={SEEKER_BOOKINGS_PATH} className="seeker-btn-primary" prefetch>
              {t("seeker.cta.bookings")}
            </Link>
            <Link href="/halls" className="seeker-btn-secondary" prefetch>
              {t("seeker.cta.explore")}
              <ArrowIcon />
            </Link>
          </div>
        </div>

        <div className="seeker-welcome-visual" aria-hidden="true">
          <div className="seeker-welcome-orb">
            <span>{initials(name)}</span>
          </div>
          <Link href={SEEKER_ACCOUNT_PATH} className="seeker-welcome-badge" prefetch>
            {t("seeker.myAccount")}
          </Link>
        </div>
      </section>

      <section className="seeker-summary" aria-labelledby="seeker-summary-heading">
        <h2 id="seeker-summary-heading" className="seeker-home-section-title">
          {t("seeker.summaryTitle")}
        </h2>
        <ul className="seeker-summary-grid">
          <li className="seeker-summary-card">
            <span className="seeker-summary-icon seeker-summary-icon--total" aria-hidden="true">
              <CalendarIcon />
            </span>
            <p className="seeker-summary-value">{statsPending ? "—" : stats.total}</p>
            <p className="seeker-summary-label">{t("seeker.stats.total")}</p>
          </li>
          <li className="seeker-summary-card">
            <span className="seeker-summary-icon seeker-summary-icon--pending" aria-hidden="true">
              <ClockIcon />
            </span>
            <p className="seeker-summary-value">{statsPending ? "—" : stats.pending}</p>
            <p className="seeker-summary-label">{t("seeker.stats.pending")}</p>
          </li>
          <li className="seeker-summary-card">
            <span className="seeker-summary-icon seeker-summary-icon--ok" aria-hidden="true">
              <CheckIcon />
            </span>
            <p className="seeker-summary-value">{statsPending ? "—" : stats.accepted}</p>
            <p className="seeker-summary-label">{t("seeker.stats.accepted")}</p>
          </li>
          <li className="seeker-summary-card">
            <span className="seeker-summary-icon seeker-summary-icon--bad" aria-hidden="true">
              <CloseIcon />
            </span>
            <p className="seeker-summary-value">{statsPending ? "—" : stats.rejected}</p>
            <p className="seeker-summary-label">{t("seeker.stats.rejected")}</p>
          </li>
        </ul>
      </section>

      <section className="seeker-pending-panel">
        <div className="seeker-pending-head">
          <h2 className="seeker-home-section-title seeker-home-section-title--inline">
            {t("seeker.pendingTitle")}
          </h2>
          <Link href={SEEKER_BOOKINGS_PATH} className="seeker-home-view-all" prefetch>
            {t("seeker.viewAll")}
            <ArrowIcon />
          </Link>
        </div>

        {statsPending ? (
          <div className="h-28 animate-pulse rounded-2xl bg-[var(--wesal-pink-soft)]" aria-busy="true" />
        ) : pendingBookings.length > 0 ? (
          <ul className="seeker-home-booking-list">
            {pendingBookings.slice(0, 4).map((item) => (
              <li key={item.bookingId} className="seeker-home-booking-row">
                <p className="font-semibold text-[var(--wesal-text)]">
                  {localizeHallName(item.hallId, item.hallName, lang) || t("common.hall")}
                </p>
                <p className="text-sm text-[var(--wesal-muted)]">
                  {item.date}
                  {" · "}
                  {item.period === "SecondPeriod"
                    ? t("bookings.period.second")
                    : t("bookings.period.first")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="seeker-pending-empty" data-testid="seeker-upcoming-empty">
            <p>{t("seeker.pendingEmpty")}</p>
            <Link href="/halls" className="seeker-home-soft-btn" prefetch>
              {t("seeker.browseHalls")}
            </Link>
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
      <path d="m6.5 12.5 3.2 3.2 7.8-7.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
