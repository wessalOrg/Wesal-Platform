/** Matches backend CoordinatorBusinessType enum names for multipart form binding. */
export type CoordinatorBusinessType = "Shop" | "Freelance";

export const COORDINATOR_WORK_PHOTO_COUNT = 2;
export const COORDINATOR_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const COORDINATOR_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const COORDINATOR_IDENTITY_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export const COORDINATOR_LIMITS = {
  maxShopNameLength: 200,
  maxOnlineStoreNameLength: 200,
  maxShopLocationLength: 500,
  maxPhoneNumberLength: 30,
} as const;

export type CoordinatorSetupSharedValues = {
  phoneNumber: string;
  identityDocument: File | null;
};

export type CoordinatorShopValues = CoordinatorSetupSharedValues & {
  businessType: "Shop";
  shopName: string;
  shopLocation: string;
  shopPhoto: File | null;
};

export type CoordinatorFreelanceValues = CoordinatorSetupSharedValues & {
  businessType: "Freelance";
  onlineStoreName: string;
  workPhotos: [File | null, File | null];
};

export type CoordinatorSetupValues = CoordinatorShopValues | CoordinatorFreelanceValues;

export type CoordinatorSetupFieldKey =
  | "businessType"
  | "shopName"
  | "shopLocation"
  | "shopPhoto"
  | "onlineStoreName"
  | "workPhotos"
  | "workPhoto0"
  | "workPhoto1"
  | "phoneNumber"
  | "identityDocument"
  | "form";

export type CoordinatorSetupFieldErrors = Partial<Record<CoordinatorSetupFieldKey, string>>;

export type CoordinatorSetupResult = {
  isSetupComplete: boolean;
  approvalStatus: string | number;
  businessType: CoordinatorBusinessType | number;
  submittedAt: string;
};
