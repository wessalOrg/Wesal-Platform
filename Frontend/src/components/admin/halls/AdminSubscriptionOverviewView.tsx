"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import AdminHallLockControls from "@/components/admin/halls/AdminHallLockControls";
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

      <section className="seeker-welcome seeker-welcome--compact">
        <div className="seeker-welcome-copy">
          <h1 className="seeker-welcome-title">{t("admin.halls.paid.overview.title")}</h1>
          <p className="seeker-welcome-body">{t("admin.halls.paid.overview.subtitle")}</p>
        </div>
      </section>

      {loading ? (
        <div
          className="seeker-pending-panel h-40 animate-pulse"
          aria-busy="true"
          data-testid="admin-subscription-overview-loading"
        />
      ) : null}

      {errorKey ? (
        <section className="seeker-pending-panel" role="alert">
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

      {!loading && !errorKey && hallCount > 0 ? (
        <section className="seeker-pending-panel">
          {groups.map((group) => (
            <div
              key={group.ownerId || group.ownerEmail || group.ownerFullName || "owner"}
              className="admin-ops-owner-group"
              data-testid="admin-subscription-owner-group"
            >
              <header className="admin-ops-owner-head">
                <h2 className="admin-ops-owner-name">
                  {group.ownerFullName || t("admin.halls.message.ownerFallback")}
                </h2>
                {group.ownerEmail || group.ownerPhoneNumber ? (
                  <p className="admin-ops-owner-meta">
                    {[group.ownerEmail, group.ownerPhoneNumber].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
              </header>

              <ul className="seeker-home-booking-list">
                {group.halls.map((hall) => (
                  <li
                    key={hall.hallId}
                    className="seeker-home-booking-row"
                    data-testid="admin-subscription-hall-row"
                    data-hall-id={hall.hallId}
                    data-payment={hall.paymentStatus}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
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
                      <div className="admin-ops-row-actions">
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
                        <AdminHallUnlockControls
                          hallId={hall.hallId}
                          adminLocked={hall.adminLocked}
                          systemLocked={hall.systemLocked}
                          variant="soft"
                          onUnlocked={(result) => {
                            applyLockState(hall.hallId, result.adminLocked, result.systemLocked);
                          }}
                        />
                        <AdminHallLockControls
                          hallId={hall.hallId}
                          adminLocked={hall.adminLocked}
                          variant="soft"
                          onLocked={(result) => {
                            applyLockState(hall.hallId, result.adminLocked, hall.systemLocked);
                            setToastKey("admin.lock.success");
                          }}
                        />
                        <Link
                          href={adminHallSubmissionPath(hall.hallId)}
                          className="btn-primary min-h-11 px-4 sm:min-h-10"
                          prefetch
                        >
                          {t("admin.halls.queue.open")}
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
