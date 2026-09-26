"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import AdminHallDeleteControls from "@/components/admin/halls/AdminHallDeleteControls";
import AdminHallLockBadge from "@/components/admin/halls/AdminHallLockBadge";
import AdminHallLockControls from "@/components/admin/halls/AdminHallLockControls";
import AdminHallPaidControls from "@/components/admin/halls/AdminHallPaidControls";
import AdminHallRejectControls from "@/components/admin/halls/AdminHallRejectControls";
import AdminHallReviewGallery from "@/components/admin/halls/AdminHallReviewGallery";
import AdminHallUnlockControls from "@/components/admin/halls/AdminHallUnlockControls";
import AdminPaymentStatusBadge from "@/components/admin/halls/AdminPaymentStatusBadge";
import AdminSecureDocumentViewer from "@/components/admin/halls/AdminSecureDocumentViewer";
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
import { fetchAdminOwnerIdentityUrl } from "@/services/admin-documents";
import { toYouTubeEmbedUrl } from "@/lib/youtube-embed";
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
        className="admin-ops-section"
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
        className="admin-ops-section"
        role="alert"
        data-testid="admin-hall-detail-error"
      >
        <p className="text-sm text-[var(--wesal-muted)]">
          {t(detail.errorKey ?? "admin.halls.detail.errors.loadFailed")}
        </p>
        <div className="admin-ops-toolbar mt-4">
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
    ? new Date(hall.submittedAt).toLocaleString(locale)
    : null;

  const hallFacts: Array<{ label: string; value: string | null }> = [
    { label: t("admin.halls.detail.region"), value: hall.regionDisplayName },
    { label: t("admin.halls.detail.address"), value: hall.address },
    { label: t("admin.halls.detail.detailedAddress"), value: hall.detailedAddress },
    {
      label: t("admin.halls.detail.capacity"),
      value: hall.capacity
        ? t("common.peopleCount", { count: hall.capacity })
        : null,
    },
    {
      label: t("admin.halls.detail.price"),
      value: hall.price != null ? `${hall.price.toLocaleString(locale)} ₪` : null,
    },
    { label: t("admin.halls.detail.submitted"), value: submitted },
  ];

  if (hall.cycleEnd) {
    hallFacts.push({
      label: t("admin.halls.paid.nextBilling"),
      value: formatBookingDateLabel(hall.cycleEnd, locale),
    });
  }
  if (hall.daysRemaining != null) {
    hallFacts.push({
      label: t("admin.halls.paid.remainingLabel"),
      value: t("admin.halls.paid.daysRemaining", { count: hall.daysRemaining }),
    });
  }

  return (
    <div className="seeker-home space-y-5" data-testid="admin-hall-detail">
      <SuccessToast
        open={Boolean(toastKey)}
        message={toastKey ? t(toastKey) : ""}
        onClose={closeToast}
      />

      <section className="seeker-welcome seeker-welcome--compact">
        <div className="seeker-welcome-copy">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="seeker-welcome-title">{t("admin.halls.detail.pageTitle")}</h1>
              <div className="admin-ops-badges mt-2">
                <HallApprovalStatusBadge status={hall.approvalBadge} />
                <AdminPaymentStatusBadge status={hall.paymentStatus} />
                {hall.adminLocked || hall.systemLocked || hall.lockBadgeVisible ? (
                  <AdminHallLockBadge
                    adminLocked={hall.adminLocked}
                    systemLocked={hall.systemLocked}
                  />
                ) : null}
              </div>
              <p className="seeker-welcome-body mt-2">{t("admin.halls.detail.subtitle")}</p>
            </div>
            <Link href={ADMIN_MANAGEMENT_PATH} className="btn-outline min-h-10 shrink-0">
              {t("admin.halls.detail.back")}
            </Link>
          </div>
        </div>
      </section>

      {approval.errorKey ? (
        <p className="rounded-xl bg-[#fdecea] px-3 py-2 text-sm text-[#b42318]" role="alert">
          {t(approval.errorKey)}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <section
          className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 shadow-[0_8px_24px_rgba(90,55,45,0.06)] sm:p-5"
          data-testid="admin-hall-detail-summary"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <HallApprovalStatusBadge status={hall.approvalBadge} />
          </div>
          <h2 className="text-lg font-extrabold text-[var(--wesal-maroon)] sm:text-xl">
            {hall.name}
          </h2>
          <dl className="admin-ops-facts mt-4">
            {hallFacts.map((fact) => (
              <DetailFact key={fact.label} label={fact.label} value={fact.value} />
            ))}
          </dl>
        </section>

        <section
          className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 shadow-[0_8px_24px_rgba(90,55,45,0.06)] sm:p-5"
          data-testid="admin-hall-detail-media"
        >
          <h2 className="admin-ops-section-title">{t("admin.halls.detail.mediaTitle")}</h2>
          <div className="mt-3">
            <AdminHallReviewGallery hallName={hall.name} photos={hall.photoUrls} />
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section
          className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 shadow-[0_8px_24px_rgba(90,55,45,0.06)] sm:p-5"
          data-testid="admin-hall-detail-owner"
        >
          <h2 className="admin-ops-section-title">{t("admin.halls.detail.ownerSection")}</h2>
          <dl className="admin-ops-facts mt-3">
            <DetailFact label={t("admin.halls.detail.owner")} value={hall.ownerFullName} />
            <DetailFact
              label={t("admin.halls.detail.phone")}
              value={hall.ownerPhoneNumber}
              dir="ltr"
            />
            <DetailFact
              label={t("admin.halls.detail.email")}
              value={hall.ownerEmail}
              dir="ltr"
            />
          </dl>
        </section>

        <section data-testid="admin-documents">
          <h2 className="mb-3 text-base font-bold text-[var(--wesal-maroon)]">
            {t("admin.halls.detail.identitySection")}
          </h2>
          <AdminSecureDocumentViewer
            available={hall.ownerHasIdentityDocument}
            labelKey="admin.halls.details.identity.view"
            hintKey="admin.halls.details.identity.hint"
            missingHintKey="admin.halls.details.identity.missing"
            errorKey="admin.halls.details.identity.errors.loadFailed"
            loadDocument={() =>
              hall.ownerId
                ? fetchAdminOwnerIdentityUrl(hall.ownerId)
                : Promise.resolve(null)
            }
            testId="admin-owner-identity-document"
          />
        </section>
      </div>

      {(hall.description || hall.features.length > 0 || hall.otherFeatures) && (
        <section className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 shadow-[0_8px_24px_rgba(90,55,45,0.06)] sm:p-5">
          {hall.description ? (
            <p className="admin-ops-description !mt-0">{hall.description}</p>
          ) : null}
          {hall.features.length > 0 ? (
            <div className={hall.description ? "mt-4" : undefined}>
              <p className="text-xs font-semibold text-[var(--wesal-muted)]">
                {t("admin.halls.detail.features")}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {hall.features.map((feature) => (
                  <li
                    key={feature}
                    className="rounded-full bg-[var(--wesal-pink)] px-3 py-1 text-xs font-semibold text-[var(--wesal-maroon)]"
                  >
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {hall.otherFeatures ? (
            <p className="mt-4 text-sm leading-7 text-[var(--wesal-text)]">
              {t("admin.halls.detail.otherFeatures")}: {hall.otherFeatures}
            </p>
          ) : null}
        </section>
      )}

      {(() => {
        const embedUrl = toYouTubeEmbedUrl(hall.youtubeVideoUrl);
        return embedUrl ? (
          <section className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-5">
            <p className="mb-2 text-xs font-semibold text-[var(--wesal-muted)]">
              {t("admin.halls.detail.youtube")}
            </p>
            <div className="aspect-video overflow-hidden rounded-xl border border-[var(--wesal-border)]">
              <iframe
                src={embedUrl}
                title={t("admin.halls.detail.youtube")}
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </section>
        ) : null;
      })()}

      <section
        className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 shadow-[0_8px_24px_rgba(90,55,45,0.06)] sm:p-5"
        data-testid="admin-hall-detail-actions"
      >
        <h2 className="admin-ops-section-title">{t("admin.halls.detail.actionsTitle")}</h2>
        <p className="mt-1 text-sm text-[var(--wesal-muted)]">
          {t("admin.halls.detail.actionsHint")}
        </p>
        <div className="admin-ops-toolbar mt-4">
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
          <MessageHallOwnerButton
            hallId={hall.hallId}
            hallName={hall.name}
            ownerName={hall.ownerFullName}
            variant="soft"
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
          <AdminHallUnlockControls
            hallId={hall.hallId}
            adminLocked={hall.adminLocked}
            systemLocked={hall.systemLocked}
            lockBadgeVisible={hall.lockBadgeVisible}
            showBadge={false}
            variant="soft"
            onUnlocked={(result) => {
              detail.applyLockState(result.adminLocked, result.systemLocked);
            }}
          />
          <AdminHallLockControls
            hallId={hall.hallId}
            adminLocked={hall.adminLocked}
            variant="soft"
            onLocked={(result) => {
              detail.applyLockState(result.adminLocked, hall.systemLocked);
              setToastKey("admin.lock.success");
            }}
          />
          <AdminHallDeleteControls hallId={hall.hallId} hallName={hall.name} />
        </div>
      </section>

      <AdminHallRejectControls
        hallId={hall.hallId}
        status={hall.status}
        onRejected={() => {
          detail.applyStatus("Rejected");
          setToastKey("admin.reject.success");
        }}
      />
    </div>
  );
}

function DetailFact({
  label,
  value,
  dir,
}: {
  label: string;
  value: string | null;
  dir?: "ltr";
}) {
  const text = value?.trim() || "—";
  return (
    <div className="admin-ops-fact">
      <dt className="admin-ops-fact-label">{label}</dt>
      <dd className="admin-ops-fact-value">
        {dir === "ltr" ? (
          <span className="admin-ops-fact-value-ltr">{text}</span>
        ) : (
          text
        )}
      </dd>
    </div>
  );
}
