"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminSecureDocumentViewer from "@/components/admin/halls/AdminSecureDocumentViewer";
import { hallFieldClassName } from "@/components/owner-management/add-hall/HallFormField";
import {
  ADMIN_COORDINATORS_PATH,
  adminCoordinatorMessagesPath,
} from "@/lib/account-profile-path";
import {
  canApproveCoordinator,
  canRejectCoordinator,
} from "@/lib/admin-coordinators-mapper";
import {
  ADMIN_COORDINATOR_REJECT_REASON_MAX,
  adminCoordinatorRejectReasonMessageKey,
  validateAdminCoordinatorRejectReason,
} from "@/lib/admin-reject-coordinator";
import { ApiError } from "@/lib/api-error";
import { useT } from "@/i18n";
import {
  approveAdminCoordinatorRequest,
  fetchAdminCoordinatorRequestDetail,
  openAdminCoordinatorConversation,
  rejectAdminCoordinatorRequest,
} from "@/services/admin-coordinators";
import {
  fetchAdminCoordinatorIdentityUrl,
  fetchAdminCoordinatorShopPhotoUrl,
  fetchAdminCoordinatorWorkPhotoUrl,
} from "@/services/admin-documents";
import type { AdminCoordinatorRequestDetail } from "@/types/admin-coordinators";
import "./admin-coordinators.css";

type AdminCoordinatorRequestDetailViewProps = {
  userId: string;
};

type DetailTab = "basic" | "business" | "gallery";

function statusLabelKey(status: AdminCoordinatorRequestDetail["approvalStatus"]): string {
  switch (status) {
    case "Approved":
      return "admin.coordinators.filter.approved";
    case "Rejected":
      return "admin.coordinators.filter.rejected";
    case "NeedsChanges":
      return "admin.coordinators.filter.needsChanges";
    case "Pending":
    default:
      return "admin.coordinators.filter.pending";
  }
}

function statusBadgeClass(
  status: AdminCoordinatorRequestDetail["approvalStatus"],
): string {
  switch (status) {
    case "Approved":
      return "admin-coord-badge admin-coord-badge--approved";
    case "Rejected":
      return "admin-coord-badge admin-coord-badge--rejected";
    case "NeedsChanges":
      return "admin-coord-badge admin-coord-badge--needs";
    case "Pending":
    default:
      return "admin-coord-badge admin-coord-badge--pending";
  }
}

function formatSubmittedAt(value: string | null, locale: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default function AdminCoordinatorRequestDetailView({
  userId,
}: AdminCoordinatorRequestDetailViewProps) {
  const t = useT();
  const router = useRouter();
  const reasonId = useId();
  const [detail, setDetail] = useState<AdminCoordinatorRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [approvePending, setApprovePending] = useState(false);
  const [rejectPending, setRejectPending] = useState(false);
  const [contactPending, setContactPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonIssue, setReasonIssue] = useState<"required" | "tooLong" | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [tab, setTab] = useState<DetailTab>("basic");

  const locale = useMemo(() => {
    if (typeof document !== "undefined" && document.documentElement.lang === "en") {
      return "en-GB";
    }
    return "ar-EG";
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const next = await fetchAdminCoordinatorRequestDetail(userId);
      setDetail(next);
    } catch (error) {
      setDetail(null);
      setLoadError(
        error instanceof ApiError && error.status === 404
          ? "admin.coordinators.detail.errors.notFound"
          : "admin.coordinators.detail.errors.loadFailed",
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const onApprove = async () => {
    if (!detail || approvePending || rejectPending) return;
    if (!canApproveCoordinator(detail.approvalStatus)) return;
    setApprovePending(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await approveAdminCoordinatorRequest(detail.userId);
      setDetail((current) =>
        current ? { ...current, approvalStatus: result.status } : current,
      );
      setActionSuccess(t("admin.coordinators.approve.success"));
      void load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setActionError(t("admin.coordinators.approve.errors.conflict"));
        void load();
      } else {
        setActionError(t("admin.coordinators.approve.errors.generic"));
      }
    } finally {
      setApprovePending(false);
    }
  };

  const onReject = async () => {
    if (!detail || approvePending || rejectPending) return;
    const issue = validateAdminCoordinatorRejectReason(reason);
    setReasonIssue(issue);
    if (issue) return;
    setRejectPending(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await rejectAdminCoordinatorRequest(detail.userId, reason);
      setDetail((current) =>
        current ? { ...current, approvalStatus: result.status } : current,
      );
      setRejectOpen(false);
      setReason("");
      setActionSuccess(t("admin.coordinators.reject.success"));
      void load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setActionError(t("admin.coordinators.reject.errors.conflict"));
        void load();
      } else {
        setActionError(t("admin.coordinators.reject.errors.generic"));
      }
    } finally {
      setRejectPending(false);
    }
  };

  const onContact = async () => {
    if (!detail || contactPending) return;
    setContactPending(true);
    setActionError(null);
    try {
      const thread = await openAdminCoordinatorConversation(detail.userId);
      const display =
        detail.businessType === "Shop"
          ? detail.shopName || detail.fullName
          : detail.onlineStoreName || detail.fullName;
      router.push(adminCoordinatorMessagesPath(thread.conversationId, display));
    } catch {
      setActionError(t("admin.coordinators.contact.errors.generic"));
    } finally {
      setContactPending(false);
    }
  };

  if (loading) {
    return (
      <div
        className="admin-coord-card h-64 animate-pulse"
        aria-busy="true"
        data-testid="admin-coordinator-detail-loading"
      />
    );
  }

  if (loadError || !detail) {
    return (
      <section className="admin-coord-card p-5" role="alert">
        <p className="text-sm text-[var(--wesal-muted)]">
          {t(loadError ?? "admin.coordinators.detail.errors.loadFailed")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-outline" onClick={() => void load()}>
            {t("common.retry")}
          </button>
          <Link href={ADMIN_COORDINATORS_PATH} className="btn-outline">
            {t("admin.coordinators.detail.back")}
          </Link>
        </div>
      </section>
    );
  }

  const showActions = canApproveCoordinator(detail.approvalStatus);
  const canReject = canRejectCoordinator(detail.approvalStatus);
  const validationText = reasonIssue
    ? t(adminCoordinatorRejectReasonMessageKey(reasonIssue))
    : null;
  const headline =
    detail.businessType === "Shop"
      ? detail.shopName || detail.fullName
      : detail.onlineStoreName || detail.fullName;
  const businessTypeLabel = t(
    detail.businessType === "Shop"
      ? "admin.coordinators.businessType.shop"
      : "admin.coordinators.businessType.freelance",
  );
  const specialtyLabel =
    detail.businessType === "Shop"
      ? detail.shopName || businessTypeLabel
      : detail.onlineStoreName || businessTypeLabel;
  const addressValue =
    detail.businessType === "Shop" ? detail.shopLocation || "—" : "—";
  const displayName = detail.fullName || headline;

  const galleryBlock = (
    <div className="admin-coord-docs-stack admin-coord-docs-stack--gallery">
      {detail.businessType === "Shop" ? (
        <AdminSecureDocumentViewer
          key={`${detail.userId}-shop`}
          available={detail.hasShopPhoto}
          sourceKey={detail.hasShopPhoto ? detail.userId : null}
          labelKey="admin.coordinators.detail.docs.shopPhoto"
          altKey="admin.coordinators.detail.docs.shopPhotoAlt"
          hintKey="admin.coordinators.detail.docs.open"
          missingHintKey="admin.coordinators.detail.docs.missing"
          errorKey="admin.coordinators.detail.docs.errors.loadFailed"
          loadDocument={() => fetchAdminCoordinatorShopPhotoUrl(detail.userId)}
          testId="admin-coordinator-shop-photo"
        />
      ) : (
        <>
          <AdminSecureDocumentViewer
            key={`${detail.userId}-work-1`}
            available={detail.hasWorkPhoto1}
            sourceKey={detail.hasWorkPhoto1 ? `${detail.userId}-1` : null}
            labelKey="admin.coordinators.detail.docs.workPhoto1"
            altKey="admin.coordinators.detail.docs.workPhoto1Alt"
            hintKey="admin.coordinators.detail.docs.open"
            missingHintKey="admin.coordinators.detail.docs.missing"
            errorKey="admin.coordinators.detail.docs.errors.loadFailed"
            loadDocument={() => fetchAdminCoordinatorWorkPhotoUrl(detail.userId, 1)}
            testId="admin-coordinator-work-photo-1"
          />
          <AdminSecureDocumentViewer
            key={`${detail.userId}-work-2`}
            available={detail.hasWorkPhoto2}
            sourceKey={detail.hasWorkPhoto2 ? `${detail.userId}-2` : null}
            labelKey="admin.coordinators.detail.docs.workPhoto2"
            altKey="admin.coordinators.detail.docs.workPhoto2Alt"
            hintKey="admin.coordinators.detail.docs.open"
            missingHintKey="admin.coordinators.detail.docs.missing"
            errorKey="admin.coordinators.detail.docs.errors.loadFailed"
            loadDocument={() => fetchAdminCoordinatorWorkPhotoUrl(detail.userId, 2)}
            testId="admin-coordinator-work-photo-2"
          />
        </>
      )}
    </div>
  );

  const identityBlock = (
    <section className="admin-coord-identity-panel admin-coord-identity-panel--sensitive">
      <div className="admin-coord-identity-head">
        <h3 className="admin-coord-info-title mb-0">
          {t("admin.coordinators.detail.identityTitle")}
        </h3>
        <span className="admin-coord-sensitive-badge">
          {t("admin.coordinators.detail.identitySensitive")}
        </span>
      </div>
      <AdminSecureDocumentViewer
        key={`${detail.userId}-identity`}
        available={detail.hasIdentityDocument}
        sourceKey={detail.hasIdentityDocument ? detail.userId : null}
        labelKey="admin.coordinators.detail.docs.identity"
        altKey="admin.coordinators.detail.docs.identityAlt"
        hintKey="admin.coordinators.detail.docs.open"
        missingHintKey="admin.coordinators.detail.docs.missing"
        errorKey="admin.coordinators.detail.docs.errors.loadFailed"
        loadDocument={() => fetchAdminCoordinatorIdentityUrl(detail.userId)}
        testId="admin-coordinator-identity"
      />
      <p className="admin-coord-sensitive-hint">
        {t("admin.coordinators.detail.identitySensitiveHint")}
      </p>
    </section>
  );

  const personalBlock = (
    <section className="admin-coord-info-panel">
      <h3 className="admin-coord-info-title">
        {t("admin.coordinators.detail.account")}
      </h3>
      <dl className="admin-coord-info-list">
        <InfoRow label={t("admin.coordinators.detail.fullName")} value={detail.fullName || "—"} />
        <InfoRow label={t("admin.coordinators.detail.email")} value={detail.email || "—"} />
        <InfoRow
          label={t("admin.coordinators.detail.userPhone")}
          value={detail.userPhoneNumber || detail.setupPhoneNumber || "—"}
        />
        <InfoRow label={t("admin.coordinators.detail.address")} value={addressValue} />
      </dl>
    </section>
  );

  const businessBlock = (
    <section className="admin-coord-info-panel">
      <h3 className="admin-coord-info-title">
        {t("admin.coordinators.detail.business")}
      </h3>
      <dl className="admin-coord-info-list">
        <InfoRow
          label={t("admin.coordinators.detail.businessType")}
          value={specialtyLabel}
        />
        <InfoRow
          label={t("admin.coordinators.detail.experience")}
          value={businessTypeLabel}
        />
        {detail.businessType === "Shop" ? (
          <InfoRow
            label={t("admin.coordinators.detail.shopLocation")}
            value={detail.shopLocation || "—"}
          />
        ) : (
          <InfoRow
            label={t("admin.coordinators.detail.onlineStoreName")}
            value={detail.onlineStoreName || "—"}
          />
        )}
        <InfoRow
          label={t("admin.coordinators.detail.submittedAt")}
          value={formatSubmittedAt(detail.submittedAt, locale)}
        />
      </dl>
    </section>
  );

  return (
    <div className="seeker-home space-y-4" data-testid="admin-coordinator-detail">
      <section className="admin-coord-review-header">
        <Link href={ADMIN_COORDINATORS_PATH} className="admin-coord-review-back">
          {t("admin.coordinators.detail.back")}
        </Link>
      </section>

      <section className="admin-coord-card admin-coord-detail-card admin-coord-review-card">
        <div
          className="admin-coord-tabs admin-coord-tabs--underline"
          role="tablist"
          aria-label={t("admin.coordinators.detail.tabsAria")}
        >
          {(
            [
              ["basic", "admin.coordinators.detail.tabs.basic"],
              ["business", "admin.coordinators.detail.tabs.business"],
              ["gallery", "admin.coordinators.detail.tabs.gallery"],
            ] as const
          ).map(([id, labelKey]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`admin-coord-tab${active ? " admin-coord-tab--active" : ""}`}
                data-testid={`admin-coordinator-tab-${id}`}
                onClick={() => setTab(id)}
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>

        {actionSuccess ? (
          <p className="mt-3 text-sm font-medium text-[var(--wesal-maroon)]" role="status">
            {actionSuccess}
          </p>
        ) : null}
        {actionError ? (
          <p className="mt-3 text-sm font-medium text-[#b42318]" role="alert">
            {actionError}
          </p>
        ) : null}

        <div className="admin-coord-review-layout">
          <aside
            className="admin-coord-review-sidebar"
            aria-label={t("admin.coordinators.detail.actions")}
            data-testid="admin-coordinator-actions"
          >
            <div className="admin-coord-review-profile">
              <span className="admin-coord-review-avatar" aria-hidden="true">
                {displayName.slice(0, 1)}
              </span>
              <div className="min-w-0 text-center">
                <h2 className="admin-coord-review-name">{displayName}</h2>
                <p className="admin-coord-review-role">
                  {t("admin.coordinators.detail.role")}
                </p>
                <p className="admin-coord-review-date">
                  {formatSubmittedAt(detail.submittedAt, locale)}
                </p>
                <span className={statusBadgeClass(detail.approvalStatus)}>
                  {t(statusLabelKey(detail.approvalStatus))}
                </span>
              </div>
            </div>

            <div className="admin-coord-review-actions">
              {showActions ? (
                <button
                  type="button"
                  className="btn-primary admin-coord-action-btn admin-coord-approve-btn !min-h-11"
                  disabled={approvePending || rejectPending}
                  aria-busy={approvePending || undefined}
                  data-testid="admin-coordinator-approve"
                  onClick={() => void onApprove()}
                >
                  <ActionIconCheck />
                  {approvePending
                    ? t("admin.coordinators.approve.submitting")
                    : t("admin.coordinators.approve.submit")}
                </button>
              ) : null}
              {canReject ? (
                <div className="admin-coord-action-block">
                  <button
                    type="button"
                    className="btn-outline admin-coord-action-btn admin-coord-reject-btn !min-h-11"
                    disabled={approvePending || rejectPending}
                    data-testid="admin-coordinator-reject-open"
                    onClick={() => {
                      setRejectOpen(true);
                      setActionError(null);
                      setTab("basic");
                    }}
                  >
                    <ActionIconClose />
                    {t("admin.coordinators.reject.submit")}
                  </button>
                  <p className="admin-coord-reject-hint">
                    {t("admin.coordinators.reject.mustWriteReason")}
                  </p>
                </div>
              ) : null}
              <button
                type="button"
                className="btn-outline admin-coord-action-btn !min-h-11"
                disabled={contactPending}
                aria-busy={contactPending || undefined}
                data-testid="admin-coordinator-contact"
                onClick={() => void onContact()}
              >
                <ActionIconChat />
                {contactPending
                  ? t("admin.coordinators.contact.opening")
                  : t("admin.coordinators.contact.submit")}
              </button>
            </div>
          </aside>

          <div className="admin-coord-review-main">
            {tab === "basic" ? (
              <div className="admin-coord-overview">
                {personalBlock}
                <section className="admin-coord-gallery-panel">
                  <h3 className="admin-coord-info-title">
                    {t("admin.coordinators.detail.galleryTitle")}
                  </h3>
                  {galleryBlock}
                </section>
                {businessBlock}
                {identityBlock}
              </div>
            ) : null}

            {tab === "business" ? businessBlock : null}

            {tab === "gallery" ? (
              <section className="admin-coord-gallery-panel">
                <h3 className="admin-coord-info-title">
                  {t("admin.coordinators.detail.galleryTitle")}
                </h3>
                {galleryBlock}
              </section>
            ) : null}

            {rejectOpen ? (
              <section
                className="admin-coord-info-panel mt-4 text-start"
                data-testid="admin-coordinator-reject-dialog"
              >
                <h3 className="admin-coord-info-title">
                  {t("admin.coordinators.reject.title")}
                </h3>
                <p className="mt-1 text-sm leading-6 text-[var(--wesal-muted)]">
                  {t("admin.coordinators.reject.subtitle")}
                </p>
                <label
                  htmlFor={reasonId}
                  className="mt-4 block text-sm font-semibold text-[var(--wesal-text)]"
                >
                  {t("admin.coordinators.reject.reasonLabel")}
                </label>
                <textarea
                  id={reasonId}
                  value={reason}
                  disabled={rejectPending}
                  maxLength={ADMIN_COORDINATOR_REJECT_REASON_MAX + 20}
                  rows={4}
                  placeholder={t("admin.coordinators.reject.reasonPlaceholder")}
                  aria-describedby={`${reasonId}-hint${validationText ? ` ${reasonId}-error` : ""}`}
                  className={`${hallFieldClassName(Boolean(validationText))} mt-2 min-h-[5.5rem] w-full resize-y`}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setReasonIssue(validateAdminCoordinatorRejectReason(event.target.value));
                  }}
                />
                <p id={`${reasonId}-hint`} className="mt-1 text-xs text-[var(--wesal-muted)]">
                  {t("admin.coordinators.reject.reasonHint", {
                    max: String(ADMIN_COORDINATOR_REJECT_REASON_MAX),
                  })}
                </p>
                {validationText ? (
                  <p id={`${reasonId}-error`} className="mt-1 text-sm text-[#b42318]" role="alert">
                    {validationText}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    className="btn-primary !min-h-11"
                    disabled={rejectPending}
                    aria-busy={rejectPending || undefined}
                    data-testid="admin-coordinator-reject-confirm"
                    onClick={() => void onReject()}
                  >
                    {rejectPending
                      ? t("admin.coordinators.reject.submitting")
                      : t("admin.coordinators.reject.confirm")}
                  </button>
                  <button
                    type="button"
                    className="btn-outline !min-h-11"
                    disabled={rejectPending}
                    onClick={() => {
                      if (!rejectPending) setRejectOpen(false);
                    }}
                  >
                    {t("admin.coordinators.reject.cancel")}
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-coord-info-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ActionIconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActionIconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ActionIconChat() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 4.5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5v5A1.5 1.5 0 0 1 11.5 11H7l-3 2v-2.2A1.5 1.5 0 0 1 3 9.5v-5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
