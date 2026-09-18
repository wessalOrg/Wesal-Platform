"use client";

import HallFormField from "@/components/owner-management/add-hall/HallFormField";
import HallFormSection from "@/components/owner-management/add-hall/HallFormSection";
import { useT } from "@/i18n";
import type {
  ExistingHallPhoto,
  HallEditFieldErrors,
} from "@/types/hall-owner-hall-management";

type HallManagementPhotosSectionProps = {
  existingPhotos: ExistingHallPhoto[];
  fieldErrors: HallEditFieldErrors;
  disabled: boolean;
  onRemoveExisting: (photoId: string) => void;
  resolveError: (value: string | undefined) => string | undefined;
};

/**
 * Edit photos: keep / remove existing URLs only.
 * wesal-api UpdateOwnerHallRequest accepts photo URLs — no multipart upload on PUT.
 */
export default function HallManagementPhotosSection({
  existingPhotos,
  fieldErrors,
  disabled,
  onRemoveExisting,
  resolveError,
}: HallManagementPhotosSectionProps) {
  const t = useT();
  const photosError = resolveError(fieldErrors.photos);

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
        {existingPhotos.length > 0 ? (
          <ul
            id="hall-mgmt-photos"
            className="owner-add-hall-photo-grid grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            aria-invalid={photosError ? true : undefined}
            aria-describedby={
              photosError ? "hall-mgmt-photos-error" : "hall-mgmt-photos-hint"
            }
          >
            {existingPhotos.map((photo) => (
              <li
                key={`existing-${photo.id}`}
                className="owner-add-hall-photo-card min-w-0 max-w-full overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)]"
              >
                <div className="aspect-[4/3] w-full min-w-0 overflow-hidden bg-white/40">
                  {/* Existing server URLs — next/image not required for owner management previews */}
                  <img
                    src={photo.url}
                    alt=""
                    className="h-full w-full max-w-full object-cover"
                  />
                </div>
                <div className="flex min-w-0 items-center gap-2 px-2.5 py-2">
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
      </HallFormField>
    </HallFormSection>
  );
}
