"use client";

import { useEffect, useMemo, useRef, type ChangeEvent } from "react";
import HallFormField from "@/components/owner-management/add-hall/HallFormField";
import HallFormSection from "@/components/owner-management/add-hall/HallFormSection";
import { useT } from "@/i18n";
import type { HallRegistrationFieldErrors } from "@/types/hall-registration";

type HallPhotosSectionProps = {
  photos: File[];
  fieldErrors: HallRegistrationFieldErrors;
  disabled: boolean;
  onAdd: (files: FileList | File[]) => void;
  onRemove: (index: number) => void;
  resolveError: (value: string | undefined) => string | undefined;
};

type PreviewItem = {
  key: string;
  name: string;
  url: string;
};

export default function HallPhotosSection({
  photos,
  fieldErrors,
  disabled,
  onAdd,
  onRemove,
  resolveError,
}: HallPhotosSectionProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const photosError = resolveError(fieldErrors.photos);

  const previews = useMemo<PreviewItem[]>(
    () =>
      photos.map((file, index) => ({
        key: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    [photos],
  );

  useEffect(() => {
    return () => {
      for (const preview of previews) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [previews]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files?.length) onAdd(files);
    event.target.value = "";
  };

  return (
    <HallFormSection
      id="hall-photos-heading"
      title={t("owner.management.addHall.sections.photos")}
    >
      <HallFormField
        id="hall-photos"
        label={t("owner.management.addHall.fields.photos")}
        required
        error={photosError}
        hint={t("owner.management.addHall.fields.photosHint")}
      >
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={inputRef}
            id="hall-photos"
            type="file"
            accept="image/*"
            multiple
            disabled={disabled}
            aria-invalid={photosError ? true : undefined}
            aria-describedby={
              photosError ? "hall-photos-error" : "hall-photos-hint"
            }
            onChange={onFileChange}
            className="sr-only"
          />
          <button
            type="button"
            disabled={disabled}
            className="btn-primary inline-flex min-h-11 w-full items-center justify-center sm:w-auto"
            data-testid="owner-add-hall-photos-pick"
            onClick={() => inputRef.current?.click()}
          >
            {t("owner.management.addHall.fields.photosPick")}
          </button>
          <p className="text-sm text-[var(--wesal-muted)]">
            {photos.length > 0
              ? t("owner.management.addHall.fields.photosCount", {
                  count: photos.length,
                })
              : t("owner.management.addHall.fields.photosHint")}
          </p>
        </div>
      </HallFormField>

      {previews.length > 0 ? (
        <ul className="owner-add-hall-photo-grid grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">
          {previews.map((preview, index) => (
            <li
              key={preview.key}
              className="owner-add-hall-photo-card min-w-0 max-w-full overflow-hidden rounded-xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)]"
            >
              <div className="aspect-[4/3] w-full min-w-0 overflow-hidden bg-white/50">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                <img
                  src={preview.url}
                  alt={preview.name}
                  className="h-full w-full max-w-full object-cover"
                />
              </div>
              <div className="flex min-w-0 items-center gap-2 px-2.5 py-2">
                <span
                  className="min-w-0 flex-1 truncate text-[11px] leading-4 text-[var(--wesal-muted)]"
                  title={preview.name}
                >
                  {preview.name}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRemove(index)}
                  className="inline-flex min-h-9 shrink-0 items-center rounded-lg px-2 text-xs font-semibold text-[#c45b55] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wesal-maroon)]/30 disabled:opacity-60"
                >
                  {t("owner.management.addHall.actions.removePhoto")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </HallFormSection>
  );
}
