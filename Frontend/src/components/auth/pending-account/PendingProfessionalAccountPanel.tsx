"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import WesalLogo from "@/components/brand/WesalLogo";
import { useT } from "@/i18n";
import {
  COORDINATOR_SETUP_PATH,
  PHOTOGRAPHER_SETUP_PATH,
  REGULAR_MESSAGES_PATH,
} from "@/lib/account-profile-path";
import { ApiError } from "@/lib/api-error";
import { isPhotographerRole } from "@/lib/account-role";
import { professionalReviewNotesBody } from "@/lib/professional-review-notes";
import {
  readPlatformNotificationsSnapshot,
  subscribePlatformNotifications,
} from "@/lib/platform-notifications-store";
import { contactAdminAccount, conversationErrorMessage } from "@/services/conversations";
import type { ProfessionalAccountPhase } from "@/types/account-approval";
import type { WesalRole } from "@/types/session";

type PendingProfessionalAccountPanelProps = {
  phase: ProfessionalAccountPhase;
  roleLabel: string;
  role?: WesalRole | null;
  canResubmitSetup?: boolean;
};

const RESUBMIT_QUERY = "mode=edit";

export default function PendingProfessionalAccountPanel({
  phase,
  roleLabel,
  role,
  canResubmitSetup = false,
}: PendingProfessionalAccountPanelProps) {
  const t = useT();
  const router = useRouter();
  const [contactPending, setContactPending] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // Re-render when the inbox changes so rejection / needs-changes notes stay fresh.
  useSyncExternalStore(
    subscribePlatformNotifications,
    readPlatformNotificationsSnapshot,
    () => "",
  );
  const adminNotes = professionalReviewNotesBody(phase);

  const isRejected = phase === "rejected";
  const isNeedsChanges = phase === "needs_changes";
  const showCorrection = isRejected || isNeedsChanges;

  const title = isNeedsChanges
    ? t("auth.pendingAccount.titleNeedsChanges")
    : isRejected
      ? t("auth.pendingAccount.titleRejected")
      : t("auth.pendingAccount.title");

  const body = isNeedsChanges
    ? t("auth.pendingAccount.bodyNeedsChanges")
    : isRejected
      ? t("auth.pendingAccount.bodyRejected")
      : t("auth.pendingAccount.body");

  const statusCopy = isNeedsChanges
    ? t("auth.pendingAccount.statusNeedsChanges")
    : isRejected
      ? t("auth.pendingAccount.statusRejected")
      : t("auth.pendingAccount.statusPending");

  const notesLabel = isNeedsChanges
    ? t("auth.pendingAccount.notesLabelNeedsChanges")
    : t("auth.pendingAccount.notesLabelRejected");

  const editHref = isPhotographerRole(role)
    ? `${PHOTOGRAPHER_SETUP_PATH}?${RESUBMIT_QUERY}`
    : `${COORDINATOR_SETUP_PATH}?${RESUBMIT_QUERY}`;

  const onContactAdmin = async () => {
    if (contactPending) return;
    setContactPending(true);
    setContactError(null);
    try {
      const thread = await contactAdminAccount();
      const href = `${REGULAR_MESSAGES_PATH}?conversation_id=${encodeURIComponent(thread.conversationId)}`;
      router.push(href);
    } catch (error) {
      setContactError(
        error instanceof ApiError
          ? conversationErrorMessage(error, "start")
          : t("auth.pendingAccount.contactAdminError"),
      );
    } finally {
      setContactPending(false);
    }
  };

  return (
    <section
      className="wesal-role-setup-card mx-auto w-full max-w-[32rem] px-6 py-8 text-center sm:px-8 sm:py-9"
      data-testid="pending-professional-account"
      data-phase={phase}
    >
      <WesalLogo className="mx-auto h-7 w-auto sm:h-8" variant="brand" />

      <p className="mt-4 text-xs font-semibold text-[var(--wesal-muted)]">{roleLabel}</p>

      <span
        className="relative mx-auto mt-4 grid size-[4.5rem] place-items-center rounded-full bg-[color-mix(in_srgb,var(--wesal-pink)_75%,white)] text-[var(--wesal-maroon)]"
        aria-hidden="true"
      >
        <span className="absolute inset-[-0.45rem] rounded-full border border-dashed border-[color-mix(in_srgb,var(--wesal-maroon)_35%,transparent)]" />
        {showCorrection ? <AlertIcon /> : <ClockIcon />}
      </span>

      <h1 className="wesal-text-bold mt-5 text-xl font-extrabold text-[var(--wesal-maroon)] sm:text-2xl">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-7 text-[var(--wesal-muted)]">{body}</p>

      <div className="mt-5 flex w-full items-center justify-between gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--wesal-maroon)_16%,#ead9d4)] bg-[#faf4f2] px-4 py-3.5 text-start">
        <div className="min-w-0">
          <p className="text-xs font-bold text-[var(--wesal-text)]">
            {t("auth.pendingAccount.statusLabel")}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--wesal-maroon)]">{statusCopy}</p>
        </div>
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[var(--wesal-maroon)] shadow-sm"
          aria-hidden="true"
        >
          {showCorrection ? <AlertIcon small /> : <ClockIcon small />}
        </span>
      </div>

      {showCorrection && adminNotes ? (
        <div
          className="mt-3 w-full rounded-2xl border border-[color-mix(in_srgb,#b42318_22%,#ead9d4)] bg-[#fff8f6] px-4 py-3.5 text-start"
          data-testid="pending-account-admin-notes"
        >
          <p className="text-xs font-bold text-[var(--wesal-text)]">{notesLabel}</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-7 text-[var(--wesal-text)]">
            {adminNotes}
          </p>
        </div>
      ) : null}

      <p className="mt-4 text-start text-[0.8rem] leading-6 text-[var(--wesal-muted)]">
        {t("auth.pendingAccount.publishUnavailable")}
      </p>

      {contactError ? (
        <p className="mt-3 text-sm font-medium text-[#b42318]" role="alert">
          {contactError}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-2.5">
        {canResubmitSetup ? (
          <Link
            href={editHref}
            className="wesal-role-setup-btn wesal-text-bold flex w-full items-center justify-center !min-h-[2.85rem]"
            data-testid="pending-account-edit-resubmit"
          >
            {t("auth.pendingAccount.editResubmit")}
          </Link>
        ) : null}
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            className={
              canResubmitSetup
                ? "wesal-role-setup-btn-outline flex-1 !min-h-[2.85rem]"
                : "wesal-role-setup-btn wesal-text-bold flex-1 !min-h-[2.85rem]"
            }
            disabled={contactPending}
            aria-busy={contactPending || undefined}
            data-testid="pending-account-contact-admin"
            onClick={() => void onContactAdmin()}
          >
            {contactPending
              ? t("auth.pendingAccount.contactAdminOpening")
              : t("auth.pendingAccount.contactAdmin")}
          </button>
          <Link
            href="/halls"
            className="wesal-role-setup-btn-outline flex flex-1 items-center justify-center !min-h-[2.85rem]"
            data-testid="pending-account-browse"
          >
            {t("auth.pendingAccount.browseWesal")}
          </Link>
        </div>
      </div>
    </section>
  );
}

function ClockIcon({ small = false }: { small?: boolean }) {
  const size = small ? "h-4 w-4" : "h-7 w-7";
  return (
    <svg viewBox="0 0 24 24" className={size} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8.5v4l2.5 1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function AlertIcon({ small = false }: { small?: boolean }) {
  const size = small ? "h-4 w-4" : "h-7 w-7";
  return (
    <svg viewBox="0 0 24 24" className={size} fill="none" aria-hidden="true">
      <path
        d="M12 4.5 20 19H4L12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M12 10v4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" />
    </svg>
  );
}
