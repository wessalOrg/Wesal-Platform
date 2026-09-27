"use client";

import { useEffect, useMemo, useRef, type ChangeEvent } from "react";
import HallImage from "@/components/halls/HallImage";
import HallFormField from "@/components/owner-management/add-hall/HallFormField";
import HallFormSection from "@/components/owner-management/add-hall/HallFormSection";
import { useT } from "@/i18n";
import type {
  ExistingHallPhoto,
  HallEditFieldErrors,
} from "@/types/hall-owner-hall-management";

type HallManagementPhotosSectionProps = {
  existingPhotos: ExistingHallPhoto[];
  newPhotos: File[];
  coverPhotoUrl: string | null;
  fieldErrors: HallEditFieldErrors;
  disabled: boolean;
  onRemoveExisting: (photoId: string) => void;
  onSetCover: (url: string) => void;
  onAddNew: (files: FileList | File[]) => void;
  onRemoveNew: (index: number) => void;
  resolveError: (value: string | undefined) => string | undefined;
};

/**
 * Edit photos: keep / remove existing IDs, add new files, and choose cover.
 */
export default function HallManagementPhotosSection({
  existingPhotos,
  newPhotos,
  coverPhotoUrl,
  fieldErrors,
  disabled,
  onRemoveExisting,
  onSetCover,
  onAddNew,
  onRemoveNew,
  resolveError,
}: HallManagementPhotosSectionProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const photosError = resolveError(fieldErrors.photos);

  const newPreviews = useMemo(
    () =>
      newPhotos.map((file, index) => ({
        key: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    [newPhotos],
  );

  useEffect(() => {
    return () => {
      for (const preview of newPreviews) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [newPreviews]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files?.length) onAddNew(files);
    event.target.value = "";
  };

  const hasPhotos = existingPhotos.length > 0 || newPreviews.length > 0;

  return (
    <HallFormSection
      id="hall-mgmt-photos-heading"
      title={t("owner.management.addHall.sections.photos")}
    >
      <HallFormField
        id="hall-mgmt-photos"
        label={t("owner.management.addHall.fields.photos")}
        required
        error={photosError}
        hint={t("owner.management.hallEdit.photosHint")}
      >
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <input
              ref={inputRef}
              id="hall-mgmt-photos-add"
              type="file"
              accept="image/*"
              multiple
              disabled={disabled}
              aria-invalid={photosError ? true : undefined}
              aria-describedby={
                photosError ? "hall-mgmt-photos-error" : "hall-mgmt-photos-hint"
              }
              onChange={onFileChange}
              className="sr-only"
            />
            <button
              type="button"
              disabled={disabled}
              className="btn-primary inline-flex min-h-11 w-full items-center justify-center sm:w-auto"
              data-testid="owner-hall-edit-photos-pick"
              onClick={() => inputRef.current?.click()}
            >
              {t("owner.management.addHall.fields.photosPick")}
            </button>
          </div>

          {hasPhotos ? (
            <ul
              id="hall-mgmt-photos"
              className="owner-add-hall-photo-grid grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {existingPhotos.map((photo) => {
                const isCover = coverPhotoUrl === photo.url;
                return (
                  <li
                    key={`existing-${photo.id}`}
                    className="owner-add-hall-photo-card min-w-0 max-w-full overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)]"
                  >
                    <div className="aspect-[4/3] w-full min-w-0 overflow-hidden bg-white/40">
                      <HallImage
                        src={photo.url}
                        alt=""
                        className="h-full w-full max-w-full object-cover"
                      />
                    </div>
                    <div className="flex min-w-0 items-center gap-2 px-2.5 py-2">
                      {isCover ? (
                        <span className="shrink-0 rounded-full bg-[var(--wesal-maroon)] px-2 py-0.5 text-[10px] font-bold text-white">
                          {t("owner.management.hallEdit.coverBadge")}
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => onSetCover(photo.url)}
                          className="inline-flex min-h-8 shrink-0 items-center rounded-lg px-2 text-[11px] font-semibold text-[var(--wesal-maroon)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wesal-maroon)]/30 disabled:opacity-60"
                        >
                          {t("owner.management.hallEdit.setAsCover")}
                        </button>
                      )}
                      <span className="min-w-0 flex-1 truncate text-[11px] leading-4 text-[var(--wesal-muted)]">
                        {t("owner.management.hallEdit.existingPhoto")}
                      </span>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onRemoveExisting(photo.id)}
                        className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-2.5 text-xs font-semibold text-[#c45b55] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wesal-maroon)]/30 disabled:opacity-60"
                      >
                        {t("owner.management.addHall.actions.removePhoto")}
                      </button>
                    </div>
                  </li>
                );
              })}
              {newPreviews.map((preview, index) => (
                <li
                  key={preview.key}
                  className="owner-add-hall-photo-card min-w-0 max-w-full overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)]"
                >
                  <div className="aspect-[4/3] w-full min-w-0 overflow-hidden bg-white/40">
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
                      onClick={() => onRemoveNew(index)}
                      className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-2.5 text-xs font-semibold text-[#c45b55] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wesal-maroon)]/30 disabled:opacity-60"
                    >
                      {t("owner.management.addHall.actions.removePhoto")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p
              id="hall-mgmt-photos"
              className="rounded-xl border border-dashed border-[var(--wesal-border)] bg-white/50 px-3 py-4 text-sm text-[var(--wesal-muted)]"
              aria-invalid={photosError ? true : undefined}
            >
              {t("owner.management.hallEdit.photosEmpty")}
            </p>
          )}
        </div>
      </HallFormField>
    </HallFormSection>
  );
}
