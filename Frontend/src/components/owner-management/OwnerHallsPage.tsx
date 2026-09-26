"use client";

import Link from "next/link";
import HallApprovalStatusBadge from "@/components/owner-management/halls/HallApprovalStatusBadge";
import HallLockedBadge from "@/components/halls/HallLockedBadge";
import OwnerHallAdminLockedNotice from "@/components/halls/OwnerHallAdminLockedNotice";
import PaymentStatusBadge from "@/components/halls/PaymentStatusBadge";
import SubscriptionExpiryWarningBanner from "@/components/halls/subscription/SubscriptionExpiryWarningBanner";
import { useAddHallInitiation } from "@/hooks/useAddHallInitiation";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import { useUiLang } from "@/components/layout/LanguageProvider";
import {
  ownerHallNotificationsPath,
  ownerHallPath,
} from "@/lib/hall-owner-query-keys";
import { localizeHallName } from "@/lib/localize-hall-display";
import { useT } from "@/i18n";

export default function OwnerHallsPage() {
  const t = useT();
  const lang = useUiLang();
  const { halls, isLoading, status, errorKey, refetch, isRefreshing } =
    useHallOwnerHalls();
  const { startAddHall, isInitiating } = useAddHallInitiation();

  const showError = status === "error" && halls.length === 0;
  const expiryWarnings = halls.filter((item) => item.expiryWarning);

  return (
    <div className="seeker-home" data-testid="owner-halls-page">
      <section className="seeker-welcome">
        <div className="seeker-welcome-copy">
          <h1 className="seeker-welcome-title">{t("owner.hallsPage.title")}</h1>
          <p className="seeker-welcome-body">{t("owner.hallsPage.subtitle")}</p>
          <div className="seeker-welcome-actions">
            <button
              type="button"
              className="seeker-btn-primary"
              disabled={isInitiating}
              aria-busy={isInitiating || undefined}
              onClick={() => {
                if (!isInitiating) void startAddHall();
              }}
            >
              {isInitiating
                ? t("owner.management.addHall.starting")
                : t("owner.cta.addHall")}
            </button>
          </div>
        </div>
      </section>

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
        <div
          className="h-40 animate-pulse rounded-[1.4rem] bg-white/80"
          aria-busy="true"
        />
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
            onClick={() => {
              if (!isInitiating) void startAddHall();
            }}
          >
            {t("owner.cta.addHall")}
          </button>
        </div>
      ) : null}

      {halls.length > 0 ? (
        <ul className="seeker-home-booking-list" data-testid="owner-halls-page-list">
          {halls.map((hall) => {
            const name = localizeHallName(hall.id, hall.name, lang);
            const adminLocked = hall.adminLocked;
            return (
            <li key={hall.id} className="seeker-home-booking-row">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--wesal-text)]">{name}</p>
                    {adminLocked ? <HallLockedBadge variant="owner" /> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <HallApprovalStatusBadge status={hall.status} />
                    <PaymentStatusBadge status={hall.paymentStatus} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {adminLocked ? (
                    <>
                      <span
                        className="seeker-home-soft-btn pointer-events-none opacity-50"
                        aria-disabled="true"
                      >
                        {t("owner.hallsPage.manage")}
                      </span>
                      <span
                        className="seeker-home-soft-btn pointer-events-none opacity-50"
                        aria-disabled="true"
                      >
                        {t("owner.hallsPage.requests")}
                      </span>
                    </>
                  ) : (
                    <>
                      <Link
                        href={ownerHallPath(hall.id)}
                        className="seeker-home-soft-btn"
                        prefetch
                      >
                        {t("owner.hallsPage.manage")}
                      </Link>
                      <Link
                        href={ownerHallNotificationsPath(hall.id)}
                        className="seeker-home-soft-btn"
                        prefetch
                      >
                        {t("owner.hallsPage.requests")}
                      </Link>
                    </>
                  )}
                </div>
              </div>
              {adminLocked ? (
                <div className="mt-3">
                  <OwnerHallAdminLockedNotice />
                </div>
              ) : null}
            </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
