export type ProfileField = "fullName" | "email" | "phoneNumber";

export type UserProfile = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  /** Server concurrency token (`ConcurrencyStamp`). */
  concurrencyStamp: string;
  /** True when the Hall Owner has uploaded an identity document (US-OWNER-30). */
  isIdentityDocumentUploaded: boolean;
};

export type UpdateProfileInput = {
  fullName: string;
  email: string;
  phoneNumber: string;
  concurrencyStamp: string;
};

export type ProfileFieldErrors = Partial<Record<ProfileField, string>>;

export type ProfileConflictCode = "email_taken" | "phone_taken" | "stale" | "conflict";
