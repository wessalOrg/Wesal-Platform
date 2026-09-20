"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useT } from "@/i18n";
import {
  fetchIdentityDocumentUrl,
  uploadIdentityDocument,
} from "@/services/owner-identity-document";
import type { UserProfile } from "@/types/profile";

type HallIdentityDocumentSectionProps = {
  profile: UserProfile;
  reload: () => void;
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const UPLOAD_ERROR_KEY = "owner.management.identity.errors.uploadFailed";

export default function HallIdentityDocumentSection({
  profile,
  reload,
}: HallIdentityDocumentSectionProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const uploaded = profile.isIdentityDocumentUploaded;

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    const mime = file.type.toLowerCase();
    if (!ACCEPTED_MIME.has(mime) || file.size > MAX_SIZE_BYTES) {
      setError("owner.management.identity.errors.invalidFile");
      setSuccess(false);
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(false);
    setPreview(null);
    setViewing(false);
    try {
      const result = await uploadIdentityDocument(file);
      setSuccess(result.hasDocument);
      if (result.hasDocument) {
        await reload();
      }
    } catch {
      setError(UPLOAD_ERROR_KEY);
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
    setPreviewLoading(true);
    setViewing(true);
    setError(null);
    try {
      const url = await fetchIdentityDocumentUrl();
      if (url) setPreview(url);
    } catch {
      setPreview(null);
      setViewing(false);
      setError("owner.management.identity.errors.loadFailed");
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <section
      className="seeker-settings-card"
      data-testid="owner-settings-identity"
    >
      <h2 className="seeker-settings-section-title">
        {t("owner.management.identity.title")}
      </h2>
      <p className="seeker-settings-section-lead">
        {t("owner.management.identity.subtitle")}
      </p>

      <div className="seeker-settings-identity-status">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
            uploaded
              ? "bg-[#e8f4e4] text-[#2e7d32]"
              : "bg-[#fdecea] text-[#c45b55]"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${uploaded ? "bg-[#2e7d32]" : "bg-[#c45b55]"}`}
            aria-hidden="true"
          />
          {t(
            uploaded
              ? "owner.management.identity.uploaded"
              : "owner.management.identity.notUploaded",
          )}
        </span>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          data-testid="owner-identity-input"
          onChange={(event) => {
            void onPick(event);
          }}
        />
        <button
          type="button"
          className="btn-primary min-h-11"
          disabled={busy}
          aria-busy={busy || undefined}
          data-testid="owner-identity-pick"
          onClick={() => inputRef.current?.click()}
        >
          {busy
            ? t("owner.management.identity.uploading")
            : uploaded
              ? t("owner.management.identity.reupload")
              : t("owner.management.identity.upload")}
        </button>

        {uploaded ? (
          <button
            type="button"
            className="btn-outline min-h-11"
            disabled={busy || previewLoading}
            data-testid="owner-identity-view"
            onClick={() => {
              void onView();
            }}
          >
            {previewLoading
              ? t("common.loading")
              : viewing
                ? t("owner.management.identity.hide")
                : t("owner.management.identity.view")}
          </button>
        ) : null}
      </div>

      <p className="mt-2 text-xs leading-5 text-[var(--wesal-muted)]">
        {t("owner.management.identity.hint")}
      </p>

      {error ? (
        <p role="alert" className="seeker-settings-alert" data-testid="owner-identity-error">
          {t(error)}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="seeker-settings-success" data-testid="owner-identity-success">
          {t("owner.management.identity.success")}
        </p>
      ) : null}

      {viewing ? (
        <div
          className="mt-3 flex max-h-[28rem] min-w-0 items-center justify-center overflow-auto rounded-xl border border-[var(--wesal-border)] bg-white/70 p-3"
          data-testid="owner-identity-preview"
        >
          {preview ? (
            <iframe
              src={preview}
              title={profile.fullName}
              className="h-full min-h-[24rem] w-full border-0"
            />
          ) : (
            <p className="text-sm text-[var(--wesal-muted)]">
              {t("owner.management.identity.previewUnavailable")}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}