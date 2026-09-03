import { ApiError } from "@/lib/api-error";
import type { ProfileConflictCode, ProfileField, ProfileFieldErrors } from "@/types/profile";

const FIELD_ALIASES: Record<string, ProfileField> = {
  fullname: "fullName",
  name: "fullName",
  email: "email",
  phonenumber: "phoneNumber",
  phone: "phoneNumber",
};

const BACKEND_MESSAGE_KEYS: Array<[RegExp, string]> = [
  [/full name is required/i, "errors.profile.fullNameRequired"],
  [/whitespace only/i, "errors.profile.fullNameRequired"],
  [/full name cannot exceed/i, "errors.profile.fullNameTooLong"],
  [/email is required/i, "errors.profile.emailRequired"],
  [/valid email/i, "errors.profile.emailInvalid"],
  [/email cannot exceed/i, "errors.profile.emailInvalid"],
  [/email is already/i, "errors.profile.emailTaken"],
  [/phone number is required/i, "errors.profile.phoneRequired"],
  [/valid phone/i, "errors.profile.phoneInvalid"],
  [/phone number cannot exceed/i, "errors.profile.phoneInvalid"],
  [/phone (number )?is already/i, "errors.profile.phoneTaken"],
  [/modified by another/i, "errors.profile.stale"],
  [/refresh and try again/i, "errors.profile.stale"],
];

export class ProfileError extends ApiError {
  fields: ProfileFieldErrors;
  code?: ProfileConflictCode;
  currentStamp?: string;

  constructor(
    message: string,
    status?: number,
    extras?: {
      fields?: ProfileFieldErrors;
      code?: ProfileConflictCode;
      currentStamp?: string;
    },
  ) {
    super(message, status);
    this.name = "ProfileError";
    this.fields = extras?.fields ?? {};
    this.code = extras?.code;
    this.currentStamp = extras?.currentStamp;
  }
}

export function normalizeProfileFieldKey(key: string): ProfileField | null {
  return FIELD_ALIASES[key.toLowerCase().replace(/[\s_-]/g, "")] ?? null;
}

export function localizeProfileMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("errors.") || trimmed.startsWith("profile.")) return trimmed;
  for (const [pattern, key] of BACKEND_MESSAGE_KEYS) {
    if (pattern.test(trimmed)) return key;
  }
  return trimmed;
}

export function fieldErrorsFromUnknown(data: unknown): ProfileFieldErrors {
  if (!data || typeof data !== "object") return {};
  const raw = (data as { errors?: Record<string, string[] | string> }).errors;
  if (!raw || typeof raw !== "object") return {};

  const fields: ProfileFieldErrors = {};
  for (const [key, value] of Object.entries(raw)) {
    const field = normalizeProfileFieldKey(key);
    const message = Array.isArray(value) ? value[0] : value;
    if (field && typeof message === "string" && message.trim()) {
      fields[field] = localizeProfileMessage(message.trim());
    }
  }
  return fields;
}

export function conflictCodeFromUnknown(err: ApiError): ProfileConflictCode {
  const details = err.details;
  const blob = [
    err.message,
    details && typeof details === "object"
      ? JSON.stringify(details)
      : typeof details === "string"
        ? details
        : "",
  ]
    .join(" ")
    .toLowerCase();

  if (blob.includes("email")) return "email_taken";
  if (blob.includes("phone")) return "phone_taken";
  if (
    blob.includes("modified") ||
    blob.includes("concurren") ||
    blob.includes("stale") ||
    blob.includes("refresh")
  ) {
    return "stale";
  }
  return "conflict";
}

export function toProfileError(err: unknown, fallback: string): ProfileError {
  if (err instanceof ProfileError) return err;
  if (err instanceof ApiError) {
    const fields = fieldErrorsFromUnknown(err.details);
    if (err.status === 400 && Object.keys(fields).length > 0) {
      return new ProfileError("errors.profile.validation", 400, { fields });
    }
    const code = err.status === 409 ? conflictCodeFromUnknown(err) : undefined;
    if (code === "email_taken" && !fields.email) {
      fields.email = "errors.profile.emailTaken";
    }
    if (code === "phone_taken" && !fields.phoneNumber) {
      fields.phoneNumber = "errors.profile.phoneTaken";
    }
    const message =
      code === "stale"
        ? "errors.profile.stale"
        : code === "email_taken"
          ? "errors.profile.emailTaken"
          : code === "phone_taken"
            ? "errors.profile.phoneTaken"
            : code === "conflict"
              ? "errors.profile.conflict"
              : localizeProfileMessage(err.message || fallback) || fallback;
    return new ProfileError(message, err.status, { fields, code });
  }
  return new ProfileError(fallback);
}
