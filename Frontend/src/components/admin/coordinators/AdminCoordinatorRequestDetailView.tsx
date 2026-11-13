"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { hallFieldClassName } from "@/components/owner-management/add-hall/HallFormField";
import {
  ADMIN_COORDINATORS_PATH,
  adminCoordinatorMessagesPath,
} from "@/lib/account-profile-path";
import {
  canApproveCoordinator,
  canRejectCoordinator,
  canRequestChangesCoordinator,
} from "@/lib/admin-coordinators-mapper";
import {
  ADMIN_COORDINATOR_REJECT_REASON_MAX,
  adminCoordinatorRejectReasonMessageKey,
  validateAdminCoordinatorRejectReason,
} from "@/lib/admin-reject-coordinator";
import {
  ADMIN_COORDINATOR_REQUEST_CHANGES_NOTES_MAX,
  adminCoordinatorRequestChangesNotesMessageKey,
  validateAdminCoordinatorRequestChangesNotes,
} from "@/lib/admin-request-changes-coordinator";
import { ApiError } from "@/lib/api-error";
import { useT } from "@/i18n";
import {
  approveAdminCoordinatorRequest,
  DEMO_COORDINATOR_REQUEST_ID,
  fetchAdminCoordinatorRequestDetail,
  openAdminCoordinatorConversation,
  rejectAdminCoordinatorRequest,
  requestChangesAdminCoordinatorRequest,
} from "@/services/admin-coordinators";
import {
  fetchAdminCoordinatorIdentityUrl,
  fetchAdminCoordinatorShopPhotoUrl,
  fetchAdminCoordinatorWorkPhotoUrl,
  fetchDemoCoordinatorGalleryFrame,
  type AdminSecureDocument,
} from "@/services/admin-documents";
import type { AdminCoordinatorRequestDetail } from "@/types/admin-coordinators";
import "./admin-coordinators.css";

type AdminCoordinatorRequestDetailViewProps = {
  userId: string;
};

type ActionPanel = null | "reject" | "changes";

type GalleryItem = {
  key: string;
  available: boolean;
  altKey: string;
  load: () => Promise<AdminSecureDocument | null>;
};

function galleryItemsFor(detail: AdminCoordinatorRequestDetail): GalleryItem[] {
  if (detail.userId === DEMO_COORDINATOR_REQUEST_ID) {
    return [1, 2, 3, 4, 5].map((index) => ({
      key: `${detail.userId}-demo-${index}`,
      available: true,
      altKey: "admin.coordinators.detail.galleryTitle",
      load: () => fetchDemoCoordinatorGalleryFrame(index),
    }));
  }
  if (detail.businessType === "Shop") {
    return [
      {
        key: `${detail.userId}-shop`,
        available: detail.hasShopPhoto,
        altKey: "admin.coordinators.detail.docs.shopPhotoAlt",
        load: () => fetchAdminCoordinatorShopPhotoUrl(detail.userId),
      },
    ];
  }
  return [
    {
      key: `${detail.userId}-work-1`,
      available: detail.hasWorkPhoto1,
      altKey: "admin.coordinators.detail.docs.workPhoto1Alt",
      load: () => fetchAdminCoordinatorWorkPhotoUrl(detail.userId, 1),
    },
    {
      key: `${detail.userId}-work-2`,
      available: detail.hasWorkPhoto2,
      altKey: "admin.coordinators.detail.docs.workPhoto2Alt",
      load: () => fetchAdminCoordinatorWorkPhotoUrl(detail.userId, 2),
    },
  ];
}

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
  const parts = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  if (year && month && day) return `${day}-${month}-${year}`;
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
  const notesId = useId();
  const [detail, setDetail] = useState<AdminCoordinatorRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [approvePending, setApprovePending] = useState(false);
  const [rejectPending, setRejectPending] = useState(false);
  const [changesPending, setChangesPending] = useState(false);
  const [contactPending, setContactPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonIssue, setReasonIssue] = useState<"required" | "tooLong" | null>(null);
  const [notes, setNotes] = useState("");
  const [notesIssue, setNotesIssue] = useState<"required" | "tooLong" | null>(null);
  const [actionPanel, setActionPanel] = useState<ActionPanel>(null);

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
    if (!detail || approvePending || rejectPending || changesPending) return;
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
    if (!detail || approvePending || rejectPending || changesPending) return;
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
      setActionPanel(null);
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

  const onRequestChanges = async () => {
    if (!detail || approvePending || rejectPending || changesPending) return;
    const issue = validateAdminCoordinatorRequestChangesNotes(notes);
    setNotesIssue(issue);
    if (issue) return;
    setChangesPending(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await requestChangesAdminCoordinatorRequest(detail.userId, notes);
      setDetail((current) =>
        current ? { ...current, approvalStatus: result.status } : current,
      );
      setNotes("");
      setActionPanel(null);
      setActionSuccess(t("admin.coordinators.requestChanges.success"));
      void load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setActionError(t("admin.coordinators.requestChanges.errors.conflict"));
        void load();
      } else {
        setActionError(t("admin.coordinators.requestChanges.errors.generic"));
      }
    } finally {
      setChangesPending(false);
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
  const canChanges = canRequestChangesCoordinator(detail.approvalStatus);
  const validationText = reasonIssue
    ? t(adminCoordinatorRejectReasonMessageKey(reasonIssue))
    : null;
  const notesValidationText = notesIssue
    ? t(adminCoordinatorRequestChangesNotesMessageKey(notesIssue))
    : null;
  const businessTypeLabel = t(
    detail.businessType === "Shop"
      ? "admin.coordinators.businessType.shop"
      : "admin.coordinators.businessType.freelance",
  );
  const specialtyLabel =
    detail.businessType === "Shop"
      ? detail.shopName || businessTypeLabel
      : detail.onlineStoreName || businessTypeLabel;
  const addressValue = detail.shopLocation || "—";
  const experienceValue =
    detail.userId === DEMO_COORDINATOR_REQUEST_ID
      ? t("admin.coordinators.detail.experienceSample")
      : businessTypeLabel;
  const busy = approvePending || rejectPending || changesPending;

  return (
    <div className="acr-page" data-testid="admin-coordinator-detail">
      <Link href={ADMIN_COORDINATORS_PATH} className="acr-back">
        {t("admin.coordinators.detail.back")}
      </Link>

      <header className="acr-hero">
        <div className="acr-hero-copy">
          <h1 className="acr-hero-title">{t("admin.coordinators.queue.title")}</h1>
          <p className="acr-hero-subtitle">{t("admin.coordinators.queue.subtitle")}</p>
        </div>
        <span className="acr-hero-icon" aria-hidden="true">
          <IconIdCardLarge />
        </span>
      </header>

      <div className="acr-tabs" role="list" aria-label={t("admin.coordinators.detail.tabsAria")}>
        {(
          [
            ["basic", "admin.coordinators.detail.tabs.basic", <IconLayers key="b" />, true],
            ["business", "admin.coordinators.detail.tabs.business", <IconMedal key="m" />, false],
            ["gallery", "admin.coordinators.detail.tabs.gallery", <IconImages key="g" />, false],
          ] as const
        ).map(([id, labelKey, icon, active]) => (
          <span
            key={id}
            role="listitem"
            className={`acr-tab${active ? " acr-tab--active" : ""}`}
            data-testid={`admin-coordinator-tab-${id}`}
          >
            {icon}
            {t(labelKey)}
          </span>
        ))}
      </div>

      {actionSuccess ? (
        <p className="admin-coord-review-flash" role="status">
          {actionSuccess}
        </p>
      ) : null}
      {actionError ? (
        <p className="admin-coord-review-flash admin-coord-review-flash--error" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="acr-grid">
        <section className="acr-card acr-profile-card">
          <div className="acr-profile-block">
            <SectionTitle icon={<IconUser />}>
              {t("admin.coordinators.detail.account")}
            </SectionTitle>
            <dl className="acr-field-list">
              <InfoRow
                icon={<IconUser />}
                label={t("admin.coordinators.detail.fullName")}
                value={detail.fullName || "—"}
              />
              <InfoRow
                icon={<IconMail />}
                label={t("admin.coordinators.detail.email")}
                value={detail.email || "—"}
              />
              <InfoRow
                icon={<IconPhone />}
                label={t("admin.coordinators.detail.userPhone")}
                value={detail.userPhoneNumber || detail.setupPhoneNumber || "—"}
              />
              <InfoRow
                icon={<IconPin />}
                label={t("admin.coordinators.detail.address")}
                value={addressValue}
              />
            </dl>
          </div>

          <div className="acr-profile-divider" role="separator" aria-hidden="true" />

          <div
            className="acr-profile-block acr-profile-block--status"
            aria-label={t("admin.coordinators.detail.actions")}
            data-testid="admin-coordinator-actions"
          >
            <SectionTitle icon={<IconClock />}>
              {t("admin.coordinators.detail.statusTitle")}
            </SectionTitle>
            <span className={`${statusBadgeClass(detail.approvalStatus)} acr-status-pill`}>
              <IconClockSmall />
              {t(statusLabelKey(detail.approvalStatus))}
            </span>
            <p className="acr-status-date">
              <IconCalendar />
              <span>
                {t("admin.coordinators.detail.submittedAt")}:{" "}
                {formatSubmittedAt(detail.submittedAt, locale)}
              </span>
            </p>
            <div className="acr-status-actions">
              {showActions ? (
                <button
                  type="button"
                  className="acr-btn acr-btn--primary"
                  disabled={busy}
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
                <button
                  type="button"
                  className="acr-btn acr-btn--outline"
                  disabled={busy}
                  data-testid="admin-coordinator-reject-open"
                  onClick={() => {
                    setActionPanel("reject");
                    setActionError(null);
                    window.setTimeout(() => {
                      document
                        .querySelector<HTMLElement>("[data-testid='admin-coordinator-reject-dialog']")
                        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }, 0);
                  }}
                >
                  <ActionIconClose />
                  {t("admin.coordinators.reject.submit")}
                </button>
              ) : null}
              <button
                type="button"
                className="acr-btn acr-btn--outline"
                disabled={busy || !canChanges}
                data-testid="admin-coordinator-request-changes-open"
                onClick={() => {
                  if (!canChanges) return;
                  setActionPanel("changes");
                  setActionError(null);
                  window.setTimeout(() => {
                    document
                      .querySelector<HTMLElement>(
                        "[data-testid='admin-coordinator-request-changes-dialog']",
                      )
                      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                  }, 0);
                }}
              >
                <ActionIconEdit />
                {t("admin.coordinators.requestChanges.submit")}
              </button>
              <button
                type="button"
                className="acr-btn acr-btn--outline"
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
          </div>
        </section>

        <CoordinatorGalleryPanel detail={detail} />

        <CoordinatorIdentityPanel
          userId={detail.userId}
          available={detail.hasIdentityDocument}
        />

        <AcrInfoCard
          className="acr-details-card"
          icon={<IconInfo />}
          title={t("admin.coordinators.detail.requestInfoTitle")}
        >
          <dl className="acr-field-list">
            <InfoRow
              icon={<IconCalendar />}
              label={t("admin.coordinators.detail.experience")}
              value={experienceValue}
            />
            <InfoRow
              icon={<IconLayers />}
              label={t("admin.coordinators.detail.businessType")}
              value={specialtyLabel}
            />
            <InfoRow
              icon={<IconDocument />}
              label={
                detail.businessType === "Shop"
                  ? t("admin.coordinators.detail.shopName")
                  : t("admin.coordinators.detail.onlineStoreName")
              }
              value={
                detail.businessType === "Shop"
                  ? detail.shopName || "—"
                  : detail.onlineStoreName || "—"
              }
            />
            <InfoRow
              icon={<IconPin />}
              label={t("admin.coordinators.detail.shopLocation")}
              value={detail.shopLocation || "—"}
            />
          </dl>
        </AcrInfoCard>

        <AcrInfoCard
          className="acr-notes-card"
          icon={<IconDocument />}
          title={t("admin.coordinators.detail.business")}
        >
          <p className="acr-notes-empty">{t("admin.coordinators.detail.notesEmpty")}</p>
        </AcrInfoCard>
      </div>

      {actionPanel === "reject" ? (
        <section className="acr-card acr-reject-card" data-testid="admin-coordinator-reject-dialog">
          <h3 className="admin-coord-info-title">{t("admin.coordinators.reject.title")}</h3>
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
              disabled={busy}
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
              disabled={busy}
              onClick={() => {
                if (!busy) setActionPanel(null);
              }}
            >
              {t("admin.coordinators.reject.cancel")}
            </button>
          </div>
        </section>
      ) : null}

      {actionPanel === "changes" ? (
        <section
          className="acr-card acr-reject-card"
          data-testid="admin-coordinator-request-changes-dialog"
        >
          <h3 className="admin-coord-info-title">
            {t("admin.coordinators.requestChanges.title")}
          </h3>
          <p className="mt-1 text-sm leading-6 text-[var(--wesal-muted)]">
            {t("admin.coordinators.requestChanges.subtitle")}
          </p>
          <label
            htmlFor={notesId}
            className="mt-4 block text-sm font-semibold text-[var(--wesal-text)]"
          >
            {t("admin.coordinators.requestChanges.notesLabel")}
          </label>
          <textarea
            id={notesId}
            value={notes}
            disabled={changesPending}
            maxLength={ADMIN_COORDINATOR_REQUEST_CHANGES_NOTES_MAX + 20}
            rows={4}
            placeholder={t("admin.coordinators.requestChanges.notesPlaceholder")}
            className={`${hallFieldClassName(Boolean(notesValidationText))} mt-2 min-h-[5.5rem] w-full resize-y`}
            onChange={(event) => {
              setNotes(event.target.value);
              setNotesIssue(validateAdminCoordinatorRequestChangesNotes(event.target.value));
            }}
          />
          <p className="mt-1 text-xs text-[var(--wesal-muted)]">
            {t("admin.coordinators.requestChanges.notesHint", {
              max: String(ADMIN_COORDINATOR_REQUEST_CHANGES_NOTES_MAX),
            })}
          </p>
          {notesValidationText ? (
            <p className="mt-1 text-sm text-[#b42318]" role="alert">
              {notesValidationText}
            </p>
          ) : null}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn-primary !min-h-11"
              disabled={busy}
              aria-busy={changesPending || undefined}
              data-testid="admin-coordinator-request-changes-confirm"
              onClick={() => void onRequestChanges()}
            >
              {changesPending
                ? t("admin.coordinators.requestChanges.submitting")
                : t("admin.coordinators.requestChanges.confirm")}
            </button>
            <button
              type="button"
              className="btn-outline !min-h-11"
              disabled={busy}
              onClick={() => {
                if (!busy) setActionPanel(null);
              }}
            >
              {t("admin.coordinators.requestChanges.cancel")}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function AcrInfoCard({
  className,
  icon,
  title,
  children,
  testId,
}: {
  className?: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section className={`acr-card ${className ?? ""}`.trim()} data-testid={testId}>
      <SectionTitle icon={icon}>{title}</SectionTitle>
      {children}
    </section>
  );
}

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h3 className="acr-card-title">
      <span className="acr-card-title-icon" aria-hidden="true">
        {icon}
      </span>
      {children}
    </h3>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="acr-field">
      <dt>{label}</dt>
      <dd>
        {icon ? <span className="acr-field-icon">{icon}</span> : null}
        <span>{value}</span>
      </dd>
    </div>
  );
}

function CoordinatorGalleryPanel({ detail }: { detail: AdminCoordinatorRequestDetail }) {
  const t = useT();
  const items = useMemo(() => galleryItemsFor(detail), [detail]);
  const [docs, setDocs] = useState<(AdminSecureDocument | null)[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const loadKey = `${detail.userId}:${detail.businessType}:${detail.hasShopPhoto}:${detail.hasWorkPhoto1}:${detail.hasWorkPhoto2}`;

  useEffect(() => {
    let cancelled = false;
    const createdUrls: string[] = [];
    setLoading(true);
    setLightboxIndex(null);
    const currentItems = galleryItemsFor(detail);
    void Promise.all(
      currentItems.map(async (item) => {
        if (!item.available) return null;
        try {
          const doc = await item.load();
          if (doc?.url) createdUrls.push(doc.url);
          return doc;
        } catch {
          return null;
        }
      }),
    ).then((next) => {
      if (cancelled) {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setDocs(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
    // loadKey encodes the photo availability + identity for this request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey]);

  const readyIndexes = docs
    .map((doc, index) => (doc?.url ? index : -1))
    .filter((index) => index >= 0);
  const featuredIndex = readyIndexes[0] ?? -1;
  const thumbIndexes = readyIndexes.slice(1);
  const missing = items.every((item) => !item.available);
  const photoCount = Math.max(readyIndexes.length, items.filter((item) => item.available).length);

  return (
    <section className="acr-card acr-gallery-card">
      <SectionTitle icon={<IconImages />}>
        {t("admin.coordinators.detail.galleryCount", { count: String(photoCount || 0) })}
      </SectionTitle>

      {missing ? (
        <p className="admin-coord-empty-hint">{t("admin.coordinators.detail.docs.missing")}</p>
      ) : loading ? (
        <div className="admin-coord-mosaic admin-coord-mosaic--loading" aria-busy="true">
          <div className="admin-coord-mosaic-featured animate-pulse" />
          <div className="admin-coord-mosaic-thumbs">
            <div className="admin-coord-mosaic-thumb animate-pulse" />
            <div className="admin-coord-mosaic-thumb animate-pulse" />
            <div className="admin-coord-mosaic-thumb animate-pulse" />
            <div className="admin-coord-mosaic-thumb animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="admin-coord-mosaic">
          <button
            type="button"
            className="admin-coord-mosaic-featured"
            disabled={featuredIndex < 0}
            onClick={() => {
              if (featuredIndex >= 0) setLightboxIndex(featuredIndex);
            }}
            data-testid="admin-coordinator-gallery-featured"
          >
            {featuredIndex >= 0 && docs[featuredIndex] ? (
              // eslint-disable-next-line @next/next/no-img-element -- authenticated blob
              <img
                src={docs[featuredIndex]!.url}
                alt={t(items[featuredIndex]?.altKey ?? "admin.coordinators.detail.galleryTitle")}
              />
            ) : (
              <span className="admin-coord-mosaic-placeholder">—</span>
            )}
          </button>
          <div className="admin-coord-mosaic-thumbs">
            {[0, 1, 2, 3].map((slot) => {
              const index = thumbIndexes[slot];
              const doc = index !== undefined ? docs[index] : null;
              const isOverflow = slot === 3 && thumbIndexes.length > 4;
              return (
                <button
                  key={`thumb-${slot}`}
                  type="button"
                  className="admin-coord-mosaic-thumb"
                  disabled={!doc}
                  onClick={() => {
                    if (index !== undefined) setLightboxIndex(index);
                  }}
                >
                  {doc ? (
                    // eslint-disable-next-line @next/next/no-img-element -- authenticated blob
                    <img src={doc.url} alt="" />
                  ) : (
                    <span className="admin-coord-mosaic-placeholder" />
                  )}
                  {isOverflow ? (
                    <span className="admin-coord-mosaic-more">+{thumbIndexes.length - 3}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        className="admin-coord-fullsize-btn"
        disabled={featuredIndex < 0}
        data-testid="admin-coordinator-gallery-fullsize"
        onClick={() => {
          if (featuredIndex >= 0) setLightboxIndex(featuredIndex);
        }}
      >
        {t("admin.coordinators.detail.viewFullSize")}
      </button>

      {lightboxIndex !== null && docs[lightboxIndex] ? (
        <DocumentLightbox
          doc={docs[lightboxIndex]!}
          alt={t(items[lightboxIndex]?.altKey ?? "admin.coordinators.detail.galleryTitle")}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </section>
  );
}

function CoordinatorIdentityPanel({
  userId,
  available,
}: {
  userId: string;
  available: boolean;
}) {
  const t = useT();
  const [doc, setDoc] = useState<AdminSecureDocument | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!available) {
      setPhase("idle");
      return;
    }
    let cancelled = false;
    let activeUrl: string | null = null;
    setPhase("loading");
    void fetchAdminCoordinatorIdentityUrl(userId)
      .then((next) => {
        if (cancelled) {
          if (next?.url) URL.revokeObjectURL(next.url);
          return;
        }
        if (!next?.url) {
          setPhase("error");
          return;
        }
        activeUrl = next.url;
        setDoc(next);
        setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) setPhase("error");
      });
    return () => {
      cancelled = true;
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [available, userId]);

  return (
    <section
      className="acr-card acr-identity-card"
      data-testid="admin-coordinator-identity"
    >
      <div className="admin-coord-identity-head">
        <SectionTitle icon={<IconIdCard />}>
          {t("admin.coordinators.detail.identityTitle")}
        </SectionTitle>
        <span className="admin-coord-sensitive-badge">
          {t("admin.coordinators.detail.identitySensitive")}
        </span>
      </div>

      {!available ? (
        <p className="admin-coord-empty-hint">{t("admin.coordinators.detail.docs.missing")}</p>
      ) : phase === "loading" ? (
        <div className="admin-coord-identity-frame animate-pulse" aria-busy="true" />
      ) : phase === "ready" && doc ? (
        <button
          type="button"
          className="admin-coord-identity-frame"
          onClick={() => setOpen(true)}
          data-testid="admin-coordinator-identity-preview"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- authenticated blob */}
          <img
            src={doc.url}
            alt={t("admin.coordinators.detail.docs.identityAlt")}
            className="admin-coord-identity-img"
          />
          <span className="admin-coord-identity-lock" aria-hidden="true">
            <IconLock />
          </span>
        </button>
      ) : (
        <p className="admin-coord-empty-hint" role="alert">
          {t("admin.coordinators.detail.docs.errors.loadFailed")}
        </p>
      )}

      <p className="admin-coord-sensitive-hint">
        {t("admin.coordinators.detail.identitySensitiveHint")}
      </p>

      {open && doc ? (
        <DocumentLightbox
          doc={doc}
          alt={t("admin.coordinators.detail.docs.identityAlt")}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </section>
  );
}

function DocumentLightbox({
  doc,
  alt,
  onClose,
}: {
  doc: AdminSecureDocument;
  alt: string;
  onClose: () => void;
}) {
  const t = useT();
  const titleId = useId();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const isImage = doc.mimeType.startsWith("image/");

  return (
    <div className="admin-coord-lightbox" role="presentation">
      <button
        type="button"
        className="admin-coord-lightbox-backdrop"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="admin-coord-lightbox-dialog"
      >
        <p id={titleId} className="sr-only">
          {alt}
        </p>
        <div className="admin-coord-lightbox-body">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated blob
            <img src={doc.url} alt={alt} />
          ) : (
            <iframe src={doc.url} title={alt} />
          )}
        </div>
        <div className="admin-coord-lightbox-footer">
          <button type="button" className="admin-coord-lightbox-close" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

function IconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5.5" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3.2 13c1.1-2.1 2.7-3.2 4.8-3.2s3.7 1.1 4.8 3.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconImages() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="5.5" cy="7" r="1" fill="currentColor" />
      <path
        d="M4 11.5 7 8.5l2 2 3-3.5 2 2.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3.75h7.5L19 8.25v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M14.5 3.75V8.5H19" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 12h6M9 15.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="12" height="9" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
      <path d="m3 5 5 3.5L13 5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4.2 2.8h2.1l1 2.4-1.3.9a7.5 7.5 0 0 0 3.9 3.9l.9-1.3 2.4 1v2.1A1.2 1.2 0 0 1 12 13.2 9.2 9.2 0 0 1 2.8 4 1.2 1.2 0 0 1 4.2 2.8Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPin() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 8.4a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M8 2.5a4.3 4.3 0 0 1 4.3 4.3c0 2.8-4.3 6.7-4.3 6.7S3.7 9.6 3.7 6.8A4.3 4.3 0 0 1 8 2.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 5v3.2l2 1.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconClockSmall() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 5v3.2l2 1.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 7.2V11M8 5.2h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="m2.5 6 5.5 3 5.5-3L8 3 2.5 6Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="m2.5 9 5.5 3 5.5-3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function IconMedal() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="9.5" r="3.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 6.5 5 2.8h6L10 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function IconIdCardLarge() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8.5" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 10.5h5M13 13.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ActionIconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="m3.5 11.2.4-2.2L10.8 2l2.2 2.2-6.9 7-2.6.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M9.5 3.5 11.8 5.8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconIdCard() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="5.5" cy="8" r="1.4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8.5 7h4M8.5 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8 10V7.5a4 4 0 0 1 8 0V10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
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
