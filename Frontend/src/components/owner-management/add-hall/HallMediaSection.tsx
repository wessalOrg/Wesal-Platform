"use client";

import { useEffect, useMemo, useRef, type ChangeEvent } from "react";
import HallFormField, {
  hallFieldClassName,
} from "@/components/owner-management/add-hall/HallFormField";
import HallFormSection from "@/components/owner-management/add-hall/HallFormSection";
import { useT } from "@/i18n";
import type {
  HallRegistrationFieldErrors,
  HallRegistrationFormValues,
} from "@/types/hall-registration";

type HallMediaSectionProps = {
  values: HallRegistrationFormValues;
  fieldErrors: HallRegistrationFieldErrors;
  disabled: boolean;
  onChange: (patch: Partial<HallRegistrationFormValues>) => void;
  resolveError: (value: string | undefined) => string | undefined;
  /** Edit flow has no cover upload — show only the video link. */
  hideMainPhoto?: boolean;
};

export default function HallMediaSection({
  values,
  fieldErrors,
  disabled,
  onChange,
  resolveError,
  hideMainPhoto = false,
}: HallMediaSectionProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const youtubeError = resolveError(fieldErrors.youtubeVideoUrl);
  const mainPhotoError = resolveError(fieldErrors.mainPhoto);

  const preview = useMemo(() => {
    if (!values.mainPhoto) return null;
    return {
      name: values.mainPhoto.name,
      url: URL.createObjectURL(values.mainPhoto),
    };
  }, [values.mainPhoto]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file) onChange({ mainPhoto: file });
    event.target.value = "";
  };

  return (
    <HallFormSection
      id="hall-media-heading"
      title={t("owner.management.addHall.sections.media")}
    >
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <HallFormField
          id="hall-youtube"
          label={t("owner.management.addHall.fields.youtubeVideoUrl")}
          error={youtubeError}
          hint={t("owner.management.addHall.fields.youtubeVideoUrlHint")}
        >
          <input
            id="hall-youtube"
            type="url"
            inputMode="url"
            dir="ltr"
            value={values.youtubeVideoUrl}
            disabled={disabled}
            autoComplete="off"
            aria-invalid={youtubeError ? true : undefined}
            aria-describedby={
              youtubeError ? "hall-youtube-error" : "hall-youtube-hint"
            }
            onChange={(event) =>
              onChange({ youtubeVideoUrl: event.target.value })
            }
            className={hallFieldClassName(Boolean(youtubeError))}
          />
        </HallFormField>

        {hideMainPhoto ? null : (
          <HallFormField
          id="hall-main-photo"
          label={t("owner.management.addHall.fields.mainPhoto")}
          error={mainPhotoError}
          hint={t("owner.management.addHall.fields.mainPhotoHint")}
        >
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <input
              ref={inputRef}
              id="hall-main-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={disabled}
              aria-invalid={mainPhotoError ? true : undefined}
              aria-describedby={
                mainPhotoError ? "hall-main-photo-error" : undefined
              }
              onChange={onFileChange}
              className="sr-only"
            />
            <button
              type="button"
              disabled={disabled}
              className="btn-primary inline-flex min-h-11 w-full items-center justify-center sm:w-auto"
              data-testid="owner-add-hall-main-photo-pick"
              onClick={() => inputRef.current?.click()}
            >
              {t("owner.management.addHall.fields.mainPhotoPick")}
            </button>
            {preview ? (
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="relative inline-flex h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-[var(--wesal-border)] bg-white/50">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                  <img
                    src={preview.url}
                    alt={preview.name}
                    className="h-full w-full object-cover"
                  />
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ mainPhoto: null })}
                  className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-[#c45b55] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wesal-maroon)]/30 disabled:opacity-60"
                >
                  {t("owner.management.addHall.fields.mainPhotoRemove")}
                </button>
              </span>
            ) : null}
          </div>
        </HallFormField>
        )}
      </div>
    </HallFormSection>
  );
}