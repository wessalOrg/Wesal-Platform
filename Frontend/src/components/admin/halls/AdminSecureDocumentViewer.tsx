"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { AdminSecureDocument } from "@/services/admin-documents";
import { useT } from "@/i18n";

type AdminSecureDocumentViewerProps = {
  /** True when the hall detail reports that an identity document was uploaded. */
  available: boolean;
  /**
   * Owner id the document belongs to. The parent keys this component on the
   * hall/owner pair, so a different owner always mounts a fresh viewer and the
   * previous document can never linger on screen.
   */
  sourceKey: string | null;
  labelKey: string;
  altKey: string;
  hintKey: string;
  missingHintKey: string;
  errorKey: string;
  loadDocument: () => Promise<AdminSecureDocument | null>;
  testId: string;
};

type LoadPhase = "idle" | "loading" | "ready" | "error";

function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/**
 * Secure preview of the Hall Owner identity document during Admin review.
 * One authenticated blob is loaded for the thumbnail and the full-size viewer.
 * Documents are never requested from public /uploads paths.
 */
export default function AdminSecureDocumentViewer({
  available,
  sourceKey,
  labelKey,
  altKey,
  hintKey,
  missingHintKey,
  errorKey,
  loadDocument,
  testId,
}: AdminSecureDocumentViewerProps) {
  const t = useT();
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<LoadPhase>(() => {
    if (!available) return "idle";
    return sourceKey ? "loading" : "error";
  });
  const [preview, setPreview] = useState<AdminSecureDocument | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!available || !sourceKey) return;

    let cancelled = false;
    let activeUrl: string | null = null;

    void loadDocument()
      .then((doc) => {
        if (cancelled) {
          if (doc?.url) URL.revokeObjectURL(doc.url);
          return;
        }
        if (!doc?.url) {
          setPhase("error");
          return;
        }
        activeUrl = doc.url;
        setPreview(doc);
        setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) setPhase("error");
      });

    return () => {
      cancelled = true;
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [available, loadDocument, sourceKey]);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      (previouslyFocused ?? trigger)?.focus();
    };
  }, [open]);

  const failPreview = () => {
    setOpen(false);
    setPhase("error");
  };

  const alt = t(altKey);
  const showDocument = phase === "ready" && preview;

  return (
    <div
      className="min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 shadow-[0_8px_24px_rgba(90,55,45,0.06)]"
      data-testid={testId}
      data-available={available || undefined}
    >
      {!available ? (
        <p className="text-xs leading-5 text-[var(--wesal-muted)]">{t(missingHintKey)}</p>
      ) : phase === "loading" ? (
        <div
          className="h-48 w-full animate-pulse rounded-xl bg-[var(--wesal-pink)]/70"
          aria-busy="true"
          role="status"
          data-testid={`${testId}-loading`}
        >
          <span className="sr-only">{t("common.loading")}</span>
        </div>
      ) : showDocument ? (
        <div className="min-w-0">
          <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-xl bg-[var(--wesal-pink-soft)] p-3">
            {isImageMime(preview.mimeType) ? (
              // eslint-disable-next-line @next/next/no-img-element -- authenticated blob, not a public asset
              <img
                src={preview.url}
                alt={alt}
                className="max-h-72 w-full object-contain"
                data-testid={`${testId}-preview`}
                onError={failPreview}
              />
            ) : (
              <iframe
                src={preview.url}
                title={alt}
                className="h-64 w-full border-0"
                data-testid={`${testId}-preview`}
              />
            )}
          </div>
          <button
            ref={triggerRef}
            type="button"
            className="btn-outline mt-3 min-h-11"
            data-testid={`${testId}-toggle`}
            onClick={() => setOpen(true)}
          >
            {t(labelKey)}
          </button>
          <p className="mt-2 text-xs leading-5 text-[var(--wesal-muted)]">{t(hintKey)}</p>
        </div>
      ) : (
        <p
          role="alert"
          className="text-xs leading-5 text-[#b42318]"
          data-testid={`${testId}-error`}
        >
          {t(errorKey)}
        </p>
      )}

      {open && showDocument ? (
        <div
          className="fixed inset-0 z-[120] overflow-y-auto overscroll-contain"
          role="presentation"
          data-testid={`${testId}-lightbox`}
        >
          <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
            <button
              type="button"
              className="fixed inset-0 bg-[rgba(40,25,20,0.72)]"
              aria-label={t("common.close")}
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="relative z-10 flex max-h-[90svh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(40,25,20,0.35)]"
            >
              <p id={titleId} className="sr-only">
                {alt}
              </p>
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 sm:p-4">
                {isImageMime(preview.mimeType) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- same authenticated blob as the thumbnail
                  <img
                    src={preview.url}
                    alt={alt}
                    className="max-h-[80svh] w-full object-contain"
                    onError={failPreview}
                  />
                ) : (
                  <iframe
                    src={preview.url}
                    title={alt}
                    className="h-[80svh] w-full border-0"
                  />
                )}
              </div>
              <div className="flex shrink-0 justify-end border-t border-[var(--wesal-border)] px-4 py-3">
                <button
                  ref={closeRef}
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wesal-pink-soft)] text-lg text-[var(--wesal-maroon)]"
                  aria-label={t("common.close")}
                  onClick={() => setOpen(false)}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
