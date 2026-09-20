"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import AdminHallLockBadge from "@/components/admin/halls/AdminHallLockBadge";
import AdminHallLockControls from "@/components/admin/halls/AdminHallLockControls";
import AdminHallPaidControls from "@/components/admin/halls/AdminHallPaidControls";
import AdminHallRejectControls from "@/components/admin/halls/AdminHallRejectControls";
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
import {
  fetchAdminOwnerIdentityUrl,
  fetchAdminPaymentReceiptUrl,
} from "@/services/admin-documents";
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
    ? new Date(hall.submittedAt).toLocaleDateString(locale)
    : null;

  const facts: Array<{ label: string; value: string | null; dir?: "ltr" }> = [
    { label: t("admin.halls.detail.owner"), value: hall.ownerFullName },
    { label: t("admin.halls.detail.email"), value: hall.ownerEmail, dir: "ltr" },
    { label: t("admin.halls.detail.phone"), value: hall.ownerPhoneNumber, dir: "ltr" },
    { label: t("admin.halls.detail.region"), value: hall.regionDisplayName },
    { label: t("admin.halls.detail.address"), value: hall.address },
    { label: t("admin.halls.detail.detailedAddress"), value: hall.detailedAddress },
    {
      label: t("admin.halls.detail.capacity"),
      value: hall.capacity ? String(hall.capacity) : null,
    },
    {
      label: t("admin.halls.detail.price"),
      value: hall.price != null ? String(hall.price) : null,
    },
    { label: t("admin.halls.detail.submitted"), value: submitted },
  ];

  if (hall.cycleEnd) {
    facts.push({
      label: t("admin.halls.paid.nextBilling"),
      value: formatBookingDateLabel(hall.cycleEnd, locale),
    });
  }
  if (hall.daysRemaining != null) {
    facts.push({
      label: t("admin.halls.paid.remainingLabel"),
      value: t("admin.halls.paid.daysRemaining", { count: hall.daysRemaining }),
    });
  }

  return (
    <div className="seeker-home" data-testid="admin-hall-detail">
      <SuccessToast
        open={Boolean(toastKey)}
        message={toastKey ? t(toastKey) : ""}
        onClose={closeToast}
      />

      <section className="seeker-welcome seeker-welcome--compact">
        <div className="seeker-welcome-copy">
          <Link href={ADMIN_MANAGEMENT_PATH} className="admin-ops-back">
            {t("admin.halls.detail.back")}
          </Link>
          <h1 className="seeker-welcome-title">{hall.name}</h1>
          <div className="admin-ops-badges">
            <HallApprovalStatusBadge status={hall.approvalBadge} />
            <AdminPaymentStatusBadge status={hall.paymentStatus} />
            {hall.adminLocked || hall.systemLocked || hall.lockBadgeVisible ? (
              <AdminHallLockBadge
                adminLocked={hall.adminLocked}
                systemLocked={hall.systemLocked}
              />
            ) : null}
          </div>
          <p className="seeker-welcome-body">{t("admin.halls.detail.subtitle")}</p>
        </div>
      </section>

      {approval.errorKey ? (
        <p className="rounded-xl bg-[#fdecea] px-3 py-2 text-sm text-[#b42318]" role="alert">
          {t(approval.errorKey)}
        </p>
      ) : null}

      <section className="admin-ops-section" data-testid="admin-hall-detail-summary">
        <h2 className="admin-ops-section-title admin-ops-section-title--center">
          {t("admin.halls.detail.summaryTitle")}
        </h2>
        <dl className="admin-ops-facts">
          {facts.map((fact) => (
            <DetailFact
              key={fact.label}
              label={fact.label}
              value={fact.value}
              dir={fact.dir}
            />
          ))}
        </dl>

        {hall.description ? (
          <p className="admin-ops-description">{hall.description}</p>
        ) : null}

        {hall.features.length > 0 ? (
          <div className="mt-4">
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

        {(() => {
          const embedUrl = toYouTubeEmbedUrl(hall.youtubeVideoUrl);
          return embedUrl ? (
            <div className="mt-5">
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
            </div>
          ) : null;
        })()}

        <div className="mt-6 grid gap-3 sm:grid-cols-2" data-testid="admin-documents">
          <AdminSecureDocumentViewer
            available={hall.ownerHasIdentityDocument}
            labelKey="admin.halls.details.identity.view"
            hintKey="admin.halls.details.identity.hint"
            missingHintKey="admin.halls.details.identity.missing"
            errorKey="admin.halls.details.identity.errors.loadFailed"
            loadDocument={() =>
              hall.ownerId ? fetchAdminOwnerIdentityUrl(hall.ownerId) : Promise.resolve(null)
            }
            testId="admin-owner-identity-document"
          />
          <AdminSecureDocumentViewer
            available={hall.hasPaymentReceipt || hall.paymentStatus === "ReceiptUploaded"}
            labelKey="admin.halls.details.receipt.view"
            hintKey="admin.halls.details.receipt.hint"
            missingHintKey="admin.halls.details.receipt.missing"
            errorKey="admin.halls.details.receipt.errors.loadFailed"
            loadDocument={() => fetchAdminPaymentReceiptUrl(hall.hallId)}
            testId="admin-payment-receipt-document"
          />
        </div>

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
      </section>

      <section className="admin-ops-section" data-testid="admin-hall-detail-actions">
        <h2 className="admin-ops-section-title">{t("admin.halls.detail.actionsTitle")}</h2>
        <div className="admin-ops-toolbar">
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