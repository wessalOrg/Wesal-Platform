"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { HallApprovalStatus } from "@/constants/hallApprovalStatus";
import type { HallPaymentStatus } from "@/constants/hallPaymentStatus";
import { useT } from "@/i18n";
import {
  fetchPaymentReceiptUrl,
  uploadPaymentReceipt,
} from "@/services/payment-receipt";

type HallPaymentReceiptSectionProps = {
  hallId: string;
  hallName: string;
  approvalStatus: HallApprovalStatus;
  paymentStatus: HallPaymentStatus;
  hasPaymentReceipt: boolean;
  onUploaded: () => void;
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function paymentStatusLabelKey(status: HallPaymentStatus): string {
  if (status === "Paid") return "owner.management.halls.payment.paid";
  if (status === "ReceiptUploaded") {
    return "owner.management.halls.payment.receiptUploaded";
  }
  return "owner.management.halls.payment.unpaid";
}

/**
 * US-OWNER-31 — upload/view the payment receipt for an Approved hall.
 * The hall stays private until the Admin confirms the payment.
 */
export default function HallPaymentReceiptSection({
  hallId,
  hallName,
  approvalStatus,
  paymentStatus,
  hasPaymentReceipt,
  onUploaded,
}: HallPaymentReceiptSectionProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const canUpload = approvalStatus === "Approved" && paymentStatus !== "Paid";
  const showPreview = hasPaymentReceipt || paymentStatus === "ReceiptUploaded";

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    const mime = file.type.toLowerCase();
    if (!ACCEPTED_MIME.has(mime) || file.size > MAX_SIZE_BYTES) {
      setError("owner.management.payment.errors.invalidFile");
      setSuccess(false);
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(false);
    setPreview(null);
    setViewing(false);
    try {
      const result = await uploadPaymentReceipt(hallId, hallName, file);
      setSuccess(result.hasReceipt || result.paymentStatus === "ReceiptUploaded");
      onUploaded();
    } catch {
      setError("owner.management.payment.errors.uploadFailed");
    } finally {
      setBusy(false);
    }
  };

  const onView = async () => {
    if (viewing) {
      setPreview(null);
      setViewing(false);
      return;
    }
    setViewing(true);
    setError(null);
    try {
      const url = await fetchPaymentReceiptUrl(hallId);
      if (url) setPreview(url);
    } catch {
      setPreview(null);
      setViewing(false);
      setError("owner.management.payment.errors.loadFailed");
    }
  };

  return (
    <section
      className="min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6"
      data-testid="owner-payment-receipt-section"
      data-payment-status={paymentStatus}
    >
      <h2 className="seeker-settings-section-title">
        {t("owner.management.payment.title")}
      </h2>
      <p className="seeker-settings-section-lead">
        {t("owner.management.payment.subtitle")}
      </p>

      <div className="mt-3">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
            paymentStatus === "Paid"
              ? "bg-[#e8f4e4] text-[#2e7d32]"
              : paymentStatus === "ReceiptUploaded"
                ? "bg-[#fdf6e3] text-[#8a6d1a]"
                : "bg-[#fdecea] text-[#c45b55]"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              paymentStatus === "Paid"
                ? "bg-[#2e7d32]"
                : paymentStatus === "ReceiptUploaded"
                  ? "bg-[#8a6d1a]"
                  : "bg-[#c45b55]"
            }`}
            aria-hidden="true"
          />
          {t(paymentStatusLabelKey(paymentStatus))}
        </span>
      </div>

      {canUpload ? (
        <>
          <div className="mt-4 flex min-w-0 flex-wrap items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
              className="sr-only"
              data-testid="owner-payment-receipt-input"
              onChange={(event) => {
                void onPick(event);
              }}
            />
            <button
              type="button"
              className="btn-primary min-h-11"
              disabled={busy}
              aria-busy={busy || undefined}
              data-testid="owner-payment-receipt-pick"
              onClick={() => inputRef.current?.click()}
            >
              {busy
                ? t("owner.management.payment.uploading")
                : t("owner.management.payment.upload")}
            </button>
            {showPreview ? (
              <button
                type="button"
                className="btn-outline min-h-11"
                disabled={busy}
                data-testid="owner-payment-receipt-view"
                onClick={() => {
                  void onView();
                }}
              >
                {viewing
                  ? t("owner.management.payment.hide")
                  : t("owner.management.payment.view")}
              </button>
            ) : null}
          </div>

          <p className="mt-2 text-xs leading-5 text-[var(--wesal-muted)]">
            {t("owner.management.payment.hint")}
          </p>
        </>
      ) : showPreview ? (
        <div className="mt-4 flex min-w-0 flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-outline min-h-11"
            disabled={busy}
            data-testid="owner-payment-receipt-view"
            onClick={() => {
              void onView();
            }}
          >
            {viewing
              ? t("owner.management.payment.hide")
              : t("owner.management.payment.view")}
          </button>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="seeker-settings-alert mt-3"
          data-testid="owner-payment-receipt-error"
        >
          {t(error)}
        </p>
      ) : null}
      {success ? (
        <p
          role="status"
          className="seeker-settings-success mt-3"
          data-testid="owner-payment-receipt-success"
        >
          {t("owner.management.payment.success")}
        </p>
      ) : null}

      {viewing ? (
        <div
          className="mt-3 flex max-h-[28rem] min-w-0 items-center justify-center overflow-auto rounded-xl border border-[var(--wesal-border)] bg-white/70 p-3"
          data-testid="owner-payment-receipt-preview"
        >
          {preview ? (
            <iframe
              src={preview}
              title={hallName}
              className="h-full min-h-[24rem] w-full border-0"
            />
          ) : (
            <p className="text-sm text-[var(--wesal-muted)]">
              {t("owner.management.payment.previewUnavailable")}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}