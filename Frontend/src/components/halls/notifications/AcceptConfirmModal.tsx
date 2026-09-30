"use client";

import { useEffect, useId, useState } from "react";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import {
  BOOKING_DEPOSIT_MAX,
  BOOKING_DEPOSIT_MIN,
  isValidDepositAmount,
  parseDepositAmount,
} from "@/lib/booking-deposits";

type AcceptConfirmModalProps = {
  open: boolean;
  busy?: boolean;
  errorKey?: string | null;
  requesterName: string;
  dateLabel?: string;
  periodLabels?: string[];
  hallName?: string | null;
  onClose: () => void;
  onConfirm: (depositAmount: number) => void;
};

export default function AcceptConfirmModal({
  open,
  busy = false,
  errorKey = null,
  requesterName,
  dateLabel,
  periodLabels = [],
  hallName,
  onClose,
  onConfirm,
}: AcceptConfirmModalProps) {
  const t = useT();
  const titleId = useId();
  const [depositDraft, setDepositDraft] = useState("");
  const [depositError, setDepositError] = useState<string | null>(null);
  // Fresh draft each time the modal opens (reconciled during render).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setDepositDraft("");
      setDepositError(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      unlockBodyScroll();
    };
  }, [busy, onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-4" data-testid="accept-confirm-overlay">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(60,40,35,0.28)]"
        aria-label={t("common.close")}
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md rounded-t-2xl bg-white px-5 py-6 shadow-[0_24px_80px_rgba(60,35,30,0.18)] sm:rounded-2xl"
        data-testid="accept-confirm-modal"
      >
        <h2 id={titleId} className="text-lg font-bold text-[var(--wesal-maroon)]">
          {t("owner.notifications.confirmAcceptTitle")}
        </h2>
        <p className="mt-2 text-sm leading-7 text-[var(--wesal-muted)]">
          {t("owner.notifications.confirmAcceptBody")}
        </p>
        <dl className="mt-4 space-y-2 rounded-xl bg-[var(--wesal-pink-soft)] px-3 py-3 text-sm">
          {hallName ? (
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--wesal-muted)]">{t("owner.notifications.hall")}</dt>
              <dd className="font-semibold text-[var(--wesal-text)]">{hallName}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--wesal-muted)]">{t("owner.notifications.requester")}</dt>
            <dd className="font-semibold text-[var(--wesal-text)]">{requesterName}</dd>
          </div>
          {dateLabel ? (
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--wesal-muted)]">{t("owner.notifications.date")}</dt>
              <dd className="font-semibold text-[var(--wesal-text)]">{dateLabel}</dd>
            </div>
          ) : null}
          {periodLabels.length > 0 ? (
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--wesal-muted)]">{t("owner.notifications.periods")}</dt>
              <dd className="text-end font-semibold text-[var(--wesal-text)]">
                {periodLabels.join(" · ")}
              </dd>
            </div>
          ) : null}
        </dl>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-semibold text-[var(--wesal-text)]">
            {t("owner.notifications.depositAmount")}
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={BOOKING_DEPOSIT_MIN}
            max={BOOKING_DEPOSIT_MAX}
            step="0.01"
            value={depositDraft}
            disabled={busy}
            placeholder={t("owner.notifications.depositPlaceholder")}
            className="h-11 w-full rounded-xl border border-[var(--wesal-border)] bg-white px-3 text-sm text-[var(--wesal-text)] outline-none focus:border-[var(--wesal-maroon)]"
            data-testid="accept-deposit-amount"
            onChange={(event) => {
              setDepositDraft(event.target.value);
              setDepositError(null);
            }}
          />
        </label>
        {depositError ? (
          <p className="mt-2 text-sm text-red-700" role="alert">
            {t(depositError)}
          </p>
        ) : null}
        {errorKey ? (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm leading-6 text-red-700" role="alert">
            {errorKey.startsWith("errors.") || errorKey.startsWith("owner.") ? t(errorKey) : errorKey}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-outline" disabled={busy} onClick={onClose}>
            {t("owner.notifications.cancel")}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            aria-busy={busy}
            data-testid="accept-confirm-submit"
            onClick={() => {
              const amount = parseDepositAmount(depositDraft);
              if (amount == null || !isValidDepositAmount(amount)) {
                setDepositError("errors.owner.accept.deposit");
                return;
              }
              onConfirm(amount);
            }}
          >
            {busy ? t("owner.notifications.accepting") : t("owner.notifications.confirmAccept")}
          </button>
        </div>
      </div>
    </div>
  );
}
