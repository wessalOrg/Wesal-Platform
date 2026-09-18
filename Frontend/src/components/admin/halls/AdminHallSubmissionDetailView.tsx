"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import AdminHallLockBadge from "@/components/admin/halls/AdminHallLockBadge";
import AdminHallPaidControls from "@/components/admin/halls/AdminHallPaidControls";
import AdminHallUnlockControls from "@/components/admin/halls/AdminHallUnlockControls";
import AdminPaymentStatusBadge from "@/components/admin/halls/AdminPaymentStatusBadge";
import ApproveHallActionButton from "@/components/admin/halls/ApproveHallActionButton";
import MessageHallOwnerButton from "@/components/admin/halls/MessageHallOwnerButton";
import HallApprovalStatusBadge from "@/components/owner-management/halls/HallApprovalStatusBadge";
import SuccessToast from "@/components/ui/SuccessToast";
import { useAdminHallDetail } from "@/hooks/useAdminHallDetail";
import { useApproveHallSubmission } from "@/hooks/useApproveHallSubmission";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { ADMIN_MANAGEMENT_PATH } from "@/lib/account-profile-path";
import { canApproveHallStatus } from "@/lib/admin-halls-mapper";
import { formatBookingDateLabel } from "@/lib/booking-date";
import { useT } from "@/i18n";

type AdminHallSubmissionDetailViewProps = {
  hallId: string;
};

export default function AdminHallSubmissionDetailView({
  hallId,
}: AdminHallSubmissionDetailViewProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const detail = useAdminHallDetail(hallId);
  const [toastKey, setToastKey] = useState<string | null>(null);

  const closeToast = useCallback(() => setToastKey(null), []);

  const approval = useApproveHallSubmission({
    onApproved: () => {
      detail.applyStatus("Approved");
      setToastKey("admin.halls.approve.success");
    },
  });

  if (detail.status === "loading" || detail.status === "idle") {
    return (
      <section
        className="min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6"
        aria-busy="true"
        data-testid="admin-hall-detail-loading"
      >
        <div className="h-40 animate-pulse rounded-xl bg-[var(--wesal-pink)]/60" />
      </section>
    );
  }

  if (detail.status === "error" || !detail.hall) {
    return (
      <section
        className="min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6"
        role="alert"
        data-testid="admin-hall-detail-error"
      >
        <p className="text-sm text-[var(--wesal-muted)]">
          {t(detail.errorKey ?? "admin.halls.detail.errors.loadFailed")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-outline" onClick={() => void detail.reload()}>
            {t("common.retry")}
          </button>
          <Link href={ADMIN_MANAGEMENT_PATH} className="btn-outline">
            {t("admin.halls.detail.back")}
          </Link>
        </div>
      </section>
    );
  }

  const hall = detail.hall;
  const canApprove = canApproveHallStatus(hall.status);
  const submitted = hall.submittedAt
    ? new Date(hall.submittedAt).toLocaleDateString("ar")
    : "—";

  return (
    <div className="seeker-home" data-testid="admin-hall-detail">
      <SuccessToast
        open={Boolean(toastKey)}
        message={toastKey ? t(toastKey) : ""}
        onClose={closeToast}
      />

      <section className="seeker-welcome">
        <div className="seeker-welcome-copy">
          <p className="mb-2">
            <Link
              href={ADMIN_MANAGEMENT_PATH}
              className="text-sm font-semibold text-[var(--wesal-maroon)]"
            >
              {t("admin.halls.detail.back")}
            </Link>
          </p>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="seeker-welcome-title">{hall.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <HallApprovalStatusBadge status={hall.approvalBadge} />
              <AdminPaymentStatusBadge status={hall.paymentStatus} />
              {hall.adminLocked || hall.systemLocked || hall.lockBadgeVisible ? (
                <AdminHallLockBadge
                  adminLocked={hall.adminLocked}
                  systemLocked={hall.systemLocked}
                />
              ) : null}
            </div>
          </div>
          <p className="seeker-welcome-body">{t("admin.halls.detail.subtitle")}</p>
        </div>
      </section>

      {approval.errorKey ? (
        <p className="mb-4 rounded-xl bg-[#fdecea] px-3 py-2 text-sm text-[#b42318]" role="alert">
          {t(approval.errorKey)}
        </p>
      ) : null}

      <section className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <DetailRow label={t("admin.halls.detail.owner")} value={hall.ownerFullName} />
          <DetailRow label={t("admin.halls.detail.email")} value={hall.ownerEmail} />
          <DetailRow label={t("admin.halls.detail.phone")} value={hall.ownerPhoneNumber} />
          <DetailRow label={t("admin.halls.detail.region")} value={hall.regionDisplayName} />
          <DetailRow label={t("admin.halls.detail.address")} value={hall.address} />
          <DetailRow
            label={t("admin.halls.detail.capacity")}
            value={hall.capacity ? String(hall.capacity) : null}
          />
          <DetailRow
            label={t("admin.halls.detail.price")}
            value={hall.price != null ? String(hall.price) : null}
          />
          <DetailRow label={t("admin.halls.detail.submitted")} value={submitted} />
          <DetailRow
            label={t("admin.halls.paid.nextBilling")}
            value={hall.cycleEnd ? formatBookingDateLabel(hall.cycleEnd, locale) : null}
          />
          <DetailRow
            label={t("admin.halls.paid.remainingLabel")}
            value={
              hall.daysRemaining == null
                ? null
                : t("admin.halls.paid.daysRemaining", { count: hall.daysRemaining })
            }
          />
        </dl>

        {hall.description ? (
          <p className="mt-4 text-sm leading-7 text-[var(--wesal-text)]">{hall.description}</p>
        ) : null}

        {hall.photoUrls.length > 0 ? (
          <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {hall.photoUrls.map((url) => (
              <li key={url} className="overflow-hidden rounded-xl bg-[var(--wesal-pink)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-28 w-full object-cover" />
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-6 flex flex-wrap items-start gap-2">
          <MessageHallOwnerButton
            hallId={hall.hallId}
            hallName={hall.name}
            ownerName={hall.ownerFullName}
            variant="primary"
          />
          {canApprove ? (
            <ApproveHallActionButton
              disabled={approval.pending}
              pending={approval.pending}
              onApprove={() => {
                approval.clearError();
                void approval.approve(hall.hallId);
              }}
            />
          ) : null}
          <AdminHallUnlockControls
            hallId={hall.hallId}
            adminLocked={hall.adminLocked}
            systemLocked={hall.systemLocked}
            lockBadgeVisible={hall.lockBadgeVisible}
            showBadge={false}
            onUnlocked={(result) => {
              detail.applyLockState(result.adminLocked, result.systemLocked);
            }}
          />
          <AdminHallPaidControls
            hallId={hall.hallId}
            status={hall.status}
            paymentStatus={hall.paymentStatus}
            systemLocked={hall.systemLocked}
            cycleEnd={hall.cycleEnd}
            showBadge={false}
            onPaid={(result) => {
              detail.applyPaidState(result);
              setToastKey(
                result.alreadyPaidWithActiveCycle
                  ? "admin.halls.paid.alreadyActive"
                  : "admin.halls.paid.success",
              );
            }}
          />
        </div>
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[var(--wesal-muted)]">{label}</dt>
      <dd className="mt-0.5 font-semibold text-[var(--wesal-text)]">{value}</dd>
    </div>
  );
}
