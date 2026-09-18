"use client";

import Link from "next/link";
import AdminHallUnlockControls from "@/components/admin/halls/AdminHallUnlockControls";
import MessageHallOwnerButton from "@/components/admin/halls/MessageHallOwnerButton";
import { useAdminPendingHalls } from "@/hooks/useAdminPendingHalls";
import { adminHallSubmissionPath } from "@/lib/account-profile-path";
import { useT } from "@/i18n";

export default function AdminPendingHallsView() {
  const t = useT();
  const { halls, loading, errorKey, reload, applyLockState } = useAdminPendingHalls();

  return (
    <div className="seeker-home" data-testid="admin-pending-halls">
      <section className="seeker-welcome">
        <div className="seeker-welcome-copy">
          <h1 className="seeker-welcome-title">{t("admin.halls.queue.title")}</h1>
          <p className="seeker-welcome-body">{t("admin.halls.queue.subtitle")}</p>
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

      {!loading && !errorKey && halls.length === 0 ? (
        <div className="seeker-pending-empty" data-testid="admin-pending-halls-empty">
          <p>{t("admin.halls.queue.empty")}</p>
        </div>
      ) : null}

      {halls.length > 0 ? (
        <ul className="seeker-home-booking-list" data-testid="admin-pending-halls-list">
          {halls.map((hall) => (
            <li key={hall.hallId} className="seeker-home-booking-row">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold text-[var(--wesal-text)]">{hall.name}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <AdminHallUnlockControls
                    hallId={hall.hallId}
                    adminLocked={hall.adminLocked}
                    systemLocked={hall.systemLocked}
                    lockBadgeVisible={hall.lockBadgeVisible}
                    variant="soft"
                    onUnlocked={(result) => {
                      applyLockState(hall.hallId, result.adminLocked, result.systemLocked);
                    }}
                  />
                  <MessageHallOwnerButton hallId={hall.hallId} hallName={hall.name} />
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
      ) : null}
    </div>
  );
}
