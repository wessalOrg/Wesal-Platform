"use client";

import { useEffect, useState } from "react";
import type { AdminSecureDocument } from "@/services/admin-documents";
import { useT } from "@/i18n";

type AdminSecureDocumentViewerProps = {
  /** True when the backend reports a document exists for this hall/owner. */
  available: boolean;
  labelKey: string;
  hintKey: string;
  missingHintKey: string;
  errorKey: string;
  loadDocument: () => Promise<AdminSecureDocument | null>;
  testId: string;
};

function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/**
 * Secure document preview for Admin review (owner identity / payment receipt).
 * Documents stream from protected Admin endpoints as blobs — never from public /uploads.
 */
export default function AdminSecureDocumentViewer({
  available,
  labelKey,
  hintKey,
  missingHintKey,
  errorKey,
  loadDocument,
  testId,
}: AdminSecureDocumentViewerProps) {
  const t = useT();
  const [viewing, setViewing] = useState(false);
  const [preview, setPreview] = useState<AdminSecureDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const onToggle = async () => {
    if (viewing) {
      setPreview(null);
      setViewing(false);
      return;
    }
    setViewing(true);
    setError(null);
    setLoading(true);
    try {
      const doc = await loadDocument();
      setPreview(doc);
    } catch {
      setPreview(null);
      setViewing(false);
      setError(errorKey);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 shadow-[0_8px_24px_rgba(90,55,45,0.06)]"
      data-testid={testId}
      data-available={available || undefined}
    >
      {available ? (
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-outline min-h-10"
            data-testid={`${testId}-toggle`}
            disabled={loading}
            aria-busy={loading || undefined}
            onClick={() => {
              void onToggle();
            }}
          >
            {loading
              ? t("common.loading")
              : viewing
                ? t("admin.halls.details.hide")
                : t(labelKey)}
          </button>
          <p className="text-xs leading-5 text-[var(--wesal-muted)]">{t(hintKey)}</p>
        </div>
      ) : (
        <p className="text-xs leading-5 text-[var(--wesal-muted)]">{t(missingHintKey)}</p>
      )}

      {error ? (
        <p
          role="alert"
          className="mt-3 text-xs text-[#b42318]"
          data-testid={`${testId}-error`}
        >
          {t(error)}
        </p>
      ) : null}

      {viewing ? (
        <div
          className="mt-3 flex max-h-[30rem] min-w-0 items-center justify-center overflow-auto rounded-xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] p-3"
          data-testid={`${testId}-preview`}
        >
          {loading && !preview ? (
            <div
              className="h-48 w-full animate-pulse rounded-lg bg-[var(--wesal-pink)]/70"
              aria-busy="true"
            />
          ) : preview ? (
            isImageMime(preview.mimeType) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.url}
                alt={t(labelKey)}
                className="max-h-[28rem] w-full max-w-full rounded-lg object-contain"
              />
            ) : (
              <iframe
                src={preview.url}
                title={t(labelKey)}
                className="h-full min-h-[16rem] w-full border-0 sm:min-h-[24rem]"
              />
            )
          ) : (
            <p className="text-sm text-[var(--wesal-muted)]">
              {t("admin.halls.details.previewUnavailable")}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
