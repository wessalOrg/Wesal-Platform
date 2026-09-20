"use client";

import { useCallback, useId, useState } from "react";
import ApprovedHallRejectDialog from "@/components/admin/halls/ApprovedHallRejectDialog";
import RejectHallActionButton from "@/components/admin/halls/RejectHallActionButton";
import { hallFieldClassName } from "@/components/owner-management/add-hall/HallFormField";
import { useRejectHall } from "@/hooks/useRejectHall";
import {
  ADMIN_REJECT_REASON_MAX,
  adminRejectReasonMessageKey,
  validateAdminRejectReason,
} from "@/lib/admin-reject-hall";
import { canRejectHallStatus } from "@/lib/admin-halls-mapper";
import type { AdminHallRejectResult, AdminHallStatus } from "@/types/admin-halls";
import { useT } from "@/i18n";

type AdminHallRejectControlsProps = {
  hallId: string;
  status: AdminHallStatus;
  onRejected?: (result: AdminHallRejectResult) => void;
};

export default function AdminHallRejectControls({
  hallId,
  status,
  onRejected,
}: AdminHallRejectControlsProps) {
  const t = useT();
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [localIssue, setLocalIssue] = useState<"tooLong" | null>(null);

  const rejectState = useRejectHall({
    onRejected: (result) => {
      setConfirmOpen(false);
      setReason("");
      onRejected?.(result);
    },
    onNeedsLiveConfirm: () => {
      setConfirmOpen(true);
    },
  });

  const closeConfirm = useCallback(() => {
    if (!rejectState.pending) setConfirmOpen(false);
  }, [rejectState.pending]);

  if (!canRejectHallStatus(status)) return null;

  const needsConfirm = status === "Approved";
  const validationText = localIssue ? t(adminRejectReasonMessageKey(localIssue)) : null;

  const submit = (confirmLiveApproved: boolean) => {
    const issue = validateAdminRejectReason(reason);
    setLocalIssue(issue);
    if (issue) return;

    rejectState.clearError();
    void rejectState.reject(hallId, {
      reason,
      confirmLiveApproved,
    });
  };

  return (
    <section className="admin-ops-section" data-testid="admin-hall-reject-controls">
      <h2 className="admin-ops-section-title">{t("admin.reject.title")}</h2>
      <p className="text-sm leading-6 text-[var(--wesal-muted)]">{t("admin.reject.subtitle")}</p>

      <label htmlFor={reasonId} className="mt-4 block text-sm font-semibold text-[var(--wesal-text)]">
        {t("admin.reject.reasonLabel")}{" "}
        <span className="font-normal text-[var(--wesal-muted)]">
          ({t("admin.reject.reasonOptional")})
        </span>
      </label>
      <textarea
        id={reasonId}
        value={reason}
        disabled={rejectState.pending}
        maxLength={ADMIN_REJECT_REASON_MAX + 20}
        rows={3}
        placeholder={t("admin.reject.reasonPlaceholder")}
        aria-describedby={`${reasonId}-hint${validationText ? ` ${reasonId}-error` : ""}`}
        className={`${hallFieldClassName(Boolean(validationText))} mt-2 min-h-[5.5rem] w-full resize-y`}
        onChange={(event) => {
          setReason(event.target.value);
          setLocalIssue(validateAdminRejectReason(event.target.value));
        }}
      />
      <p id={`${reasonId}-hint`} className="mt-1 text-xs text-[var(--wesal-muted)]">
        {t("admin.reject.reasonHint")}
      </p>
      {validationText ? (
        <p id={`${reasonId}-error`} className="mt-1 text-sm text-[#b42318]" role="alert">
          {validationText}
        </p>
      ) : null}

      {rejectState.errorKey ? (
        <p className="mt-3 rounded-xl bg-[#fdecea] px-3 py-2 text-sm text-[#b42318]" role="alert">
          {t(rejectState.errorKey)}
        </p>
      ) : null}

      <div className="mt-4">
        <RejectHallActionButton
          disabled={rejectState.pending || Boolean(localIssue)}
          pending={rejectState.pending && !confirmOpen}
          onReject={() => {
            if (needsConfirm) {
              const issue = validateAdminRejectReason(reason);
              setLocalIssue(issue);
              if (issue) return;
              rejectState.clearError();
              setConfirmOpen(true);
              return;
            }
            submit(false);
          }}
        />
      </div>

      <ApprovedHallRejectDialog
        open={confirmOpen}
        busy={rejectState.pending}
        onClose={closeConfirm}
        onConfirm={() => submit(true)}
      />
    </section>
  );
}
