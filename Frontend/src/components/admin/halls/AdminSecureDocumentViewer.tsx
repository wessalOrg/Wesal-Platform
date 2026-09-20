"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n";

type AdminSecureDocumentViewerProps = {
  /** True when the backend reports a document exists for this hall/owner. */
  available: boolean;
  labelKey: string;
  hintKey: string;
  missingHintKey: string;
  errorKey: string;
  loadDocument: () => Promise<string | null>;
  testId: string;
};

/**
 * Secure document preview for Admin review (payment receipt / owner identity).
 * Documents stream from protected Admin endpoints as blobs and are shown in an
 * iframe preview — never served from the public media area.
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
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
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
    try {
      const url = await loadDocument();
      setPreview(url);
    } catch {
      setPreview(null);
      setViewing(false);
      setError(errorKey);
    }
  };

  return (
    <div
      className="min-w-0 rounded-xl border border-[var(--wesal-border)] bg-white/60 p-4"
      data-testid={testId}
      data-available={available || undefined}
    >
      {available ? (
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-outline min-h-10"
            data-testid={`${testId}-toggle`}
            onClick={() => {
              void onToggle();
            }}
          >
            {viewing ? t("admin.halls.details.hide") : t(labelKey)}
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
          className="mt-3 flex max-h-[30rem] min-w-0 items-center justify-center overflow-auto rounded-xl border border-[var(--wesal-border)] bg-white/70 p-3"
          data-testid={`${testId}-preview`}
        >
          {preview ? (
            <iframe
              src={preview}
              title={t(labelKey)}
              className="h-full min-h-[24rem] w-full border-0"
            />
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