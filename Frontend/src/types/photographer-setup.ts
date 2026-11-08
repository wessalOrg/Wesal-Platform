/**
 * Photographer setup form models aligned with backend
 * PhotographerSetupRequest / PhotographerSetupSubmission multipart contract.
 */

export const PHOTOGRAPHER_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const PHOTOGRAPHER_IDENTITY_ACCEPT =
  "image/jpeg,image/png,image/webp,application/pdf";

export const PHOTOGRAPHER_LIMITS = {
  maxStudioNameLength: 200,
  maxStudioLocationLength: 500,
  maxDetailedStudioLocationLength: 500,
  maxFullNameLength: 150,
  maxPhoneNumberLength: 30,
} as const;

export type PhotographerSetupSharedValues = {
  phoneNumber: string;
  identityDocument: File | null;
};

export type PhotographerStudioValues = PhotographerSetupSharedValues & {
  hasStudio: true;
  studioName: string;
  studioLocation: string;
  detailedStudioLocation: string;
};

export type PhotographerIndependentValues = PhotographerSetupSharedValues & {
  hasStudio: false;
  fullName: string;
};

export type PhotographerSetupValues =
  | PhotographerStudioValues
  | PhotographerIndependentValues;

export type PhotographerSetupFieldKey =
  | "hasStudio"
  | "studioName"
  | "studioLocation"
  | "detailedStudioLocation"
  | "fullName"
  | "phoneNumber"
  | "identityDocument"
  | "form";

export type PhotographerSetupFieldErrors = Partial<
  Record<PhotographerSetupFieldKey, string>
>;

export type PhotographerSetupResult = {
  isSetupComplete: boolean;
  approvalStatus: string | number;
  hasStudio: boolean;
  submittedAt: string;
};
