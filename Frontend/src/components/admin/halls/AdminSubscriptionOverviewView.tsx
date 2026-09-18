"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import AdminHallPaidControls from "@/components/admin/halls/AdminHallPaidControls";
import AdminHallUnlockControls from "@/components/admin/halls/AdminHallUnlockControls";
import AdminPaymentStatusBadge from "@/components/admin/halls/AdminPaymentStatusBadge";
import SuccessToast from "@/components/ui/SuccessToast";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useAdminSubscriptionOverview } from "@/hooks/useAdminSubscriptionOverview";
import { adminHallSubmissionPath } from "@/lib/account-profile-path";
import { formatBookingDateLabel } from "@/lib/booking-date";
import { useT } from "@/i18n";

export default function AdminSubscriptionOverviewView() {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const { groups, loading, errorKey, reload, applyPaidState, applyLockState } =
    useAdminSubscriptionOverview();
  const [toastKey, setToastKey] = useState<string | null>(null);
  const closeToast = useCallback(() => setToastKey(null), []);
  const hallCount = groups.reduce((total, group) => total + group.halls.length, 0);

  return (
    <div className="seeker-home" data-testid="admin-subscription-overview">
      <SuccessToast
        open={Boolean(toastKey)}
        message={toastKey ? t(toastKey) : ""}
        onClose={closeToast}
      />

      <section className="seeker-welcome">
        <div className="seeker-welcome-copy">
          <h1 className="seeker-welcome-title">{t("admin.halls.paid.overview.title")}</h1>
          <p className="seeker-welcome-body">{t("admin.halls.paid.overview.subtitle")}</p>
        </div>
      </section>

      {loading ? (
        <div className="h-40 animate-pulse rounded-[1.4rem] bg-white/80" aria-busy="true" />
      ) : null}

      {errorKey ? (
        <section className="rounded-2xl bg-white p-6" role="alert">
          <p className="text-sm text-[var(--wesal-muted)]">{t(errorKey)}</p>
          <button type="button" className="btn-outline mt-4" onClick={() => void reload()}>
            {t("common.retry")}
          </button>
        </section>
      ) : null}

      {!loading && !errorKey && hallCount === 0 ? (
        <div className="seeker-pending-empty" data-testid="admin-subscription-overview-empty">
          <p>{t("admin.halls.paid.overview.empty")}</p>
        </div>
      ) : null}

      {groups.map((group) => (
        <section
          key={group.ownerId || group.ownerEmail || group.ownerFullName || "owner"}
          className="mb-4 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-5"
          data-testid="admin-subscription-owner-group"
        >
          <h2 className="text-base font-bold text-[var(--wesal-maroon)]">
            {group.ownerFullName || t("admin.halls.message.ownerFallback")}
          </h2>
          {group.ownerEmail || group.ownerPhoneNumber ? (
            <p className="mt-1 text-sm text-[var(--wesal-muted)]">
              {[group.ownerEmail, group.ownerPhoneNumber].filter(Boolean).join(" · ")}
            </p>
          ) : null}

          <ul className="mt-4 space-y-3">
            {group.halls.map((hall) => (
              <li
                key={hall.hallId}
                className="rounded-xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] p-3 sm:p-4"
                data-testid="admin-subscription-hall-row"
                data-hall-id={hall.hallId}
                data-payment={hall.paymentStatus}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--wesal-text)]">{hall.name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <AdminPaymentStatusBadge status={hall.paymentStatus} />
                    </div>
                    {hall.nextBillingDate ? (
                      <p className="mt-2 text-sm text-[var(--wesal-muted)]">
                        {t("admin.halls.paid.nextBilling")}:{" "}
                        {formatBookingDateLabel(hall.nextBillingDate, locale)}
                        {hall.daysRemaining != null
                          ? ` · ${t("admin.halls.paid.daysRemaining", { count: hall.daysRemaining })}`
                          : ""}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-[var(--wesal-muted)]">
                        {t("admin.halls.paid.noCycle")}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminHallUnlockControls
                      hallId={hall.hallId}
                      adminLocked={hall.adminLocked}
                      systemLocked={hall.systemLocked}
                      variant="soft"
                      onUnlocked={(result) => {
                        applyLockState(hall.hallId, result.adminLocked, result.systemLocked);
                      }}
                    />
                    <AdminHallPaidControls
                      hallId={hall.hallId}
                      status={hall.approvalStatus}
                      paymentStatus={hall.paymentStatus}
                      systemLocked={hall.systemLocked}
                      cycleEnd={hall.nextBillingDate}
                      variant="soft"
                      showBadge={false}
                      onPaid={(result) => {
                        applyPaidState(result);
                        setToastKey(
                          result.alreadyPaidWithActiveCycle
                            ? "admin.halls.paid.alreadyActive"
                            : "admin.halls.paid.success",
                        );
                      }}
                    />
                    <Link
                      href={adminHallSubmissionPath(hall.hallId)}
                      className="seeker-home-soft-btn"
                      prefetch
                    >
                      {t("admin.halls.queue.open")}
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
