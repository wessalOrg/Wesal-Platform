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
  /**
   * Role-setup completion from GET /profile (`IsSetupComplete`).
   * Null when the payload omits the field.
   */
  isSetupComplete: boolean | null;
  /**
   * Account approval from GET /profile (`ApprovalStatus` string).
   * Null when omitted or unrecognized — treat as fail-closed for publish.
   */
  approvalStatus: string | null;
  /** Present only when the profile payload includes a join/created timestamp. */
  createdAt?: string | null;
  /** Active publishing restriction (moderation lock). */
  isLocked?: boolean;
  /** UTC end of the publishing restriction window. */
  lockedUntil?: string | null;
};

export type UpdateProfileInput = {
  fullName: string;
  email: string;
  phoneNumber: string;
  concurrencyStamp: string;
};

export type ProfileFieldErrors = Partial<Record<ProfileField, string>>;

export type ProfileConflictCode = "email_taken" | "phone_taken" | "stale" | "conflict";
