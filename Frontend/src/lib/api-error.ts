export class ApiError extends Error {
  status?: number;
  detail?: string;
  code?: string;
  /** ASP.NET ValidationProblemDetails field map (e.g. AccountType → messages). */
  fieldErrors: Record<string, string[]>;

  constructor(
    message: string,
    status?: number,
    fieldErrors: Record<string, string[]> = {},
    options?: { detail?: string; code?: string },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.detail = options?.detail;
    this.code = options?.code;
  }
}

const META_KEYS = new Set([
  "type",
  "title",
  "status",
  "traceId",
  "message",
  "detail",
  "code",
  "instance",
]);

function normalizeFieldKey(key: string): string {
  return key.replace(/^\$\./, "").replace(/^\./, "");
}

/** Pull field errors from ValidationProblemDetails / FluentValidation payloads. */
export function parseApiFieldErrors(data: unknown): Record<string, string[]> {
  if (!data || typeof data !== "object") return {};

  const root = data as Record<string, unknown>;
  const source =
    root.errors && typeof root.errors === "object"
      ? (root.errors as Record<string, unknown>)
      : root;

  const result: Record<string, string[]> = {};

  for (const [rawKey, value] of Object.entries(source)) {
    if (META_KEYS.has(rawKey)) continue;
    const key = normalizeFieldKey(rawKey);
    if (Array.isArray(value)) {
      const messages = value.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      );
      if (messages.length > 0) result[key] = messages;
    } else if (typeof value === "string" && value.trim()) {
      result[key] = [value];
    }
  }

  return result;
}

export function getApiFieldMessages(error: ApiError, field: string): string[] {
  const target = field.toLowerCase();
  for (const [key, messages] of Object.entries(error.fieldErrors)) {
    if (key.toLowerCase() === target) return messages;
  }
  return [];
}

export function hasApiFieldError(error: ApiError, field: string): boolean {
  return getApiFieldMessages(error, field).length > 0;
}

/** True when backend rejected the selected registration account type. */
export function isInvalidAccountTypeError(error: ApiError): boolean {
  if (hasApiFieldError(error, "AccountType") || hasApiFieldError(error, "accountType")) {
    return true;
  }
  const message = `${error.detail ?? ""} ${error.message}`.toLowerCase();
  return message.includes("account type") || message.includes("accounttype");
}

export type RegisterConflictKind = "email" | "phone" | "generic";

function conflictText(error: ApiError): string {
  return `${error.detail ?? ""} ${error.message}`.toLowerCase();
}

/** Detect duplicate email/phone (HTTP 409 Conflict) from registration. */
export function getRegisterConflictKind(error: ApiError): RegisterConflictKind | null {
  const text = conflictText(error);
  const isConflictStatus = error.status === 409 || error.code === "Conflict";
  const looksLikeDuplicate =
    text.includes("already exists") ||
    text.includes("already in use") ||
    text.includes("duplicate");

  if (!isConflictStatus && !looksLikeDuplicate) return null;

  if (text.includes("email")) return "email";
  if (text.includes("phone")) return "phone";
  if (isConflictStatus) return "generic";
  return null;
}

const REGISTER_FIELD_ALIASES: Record<string, string> = {
  fullname: "fullName",
  email: "email",
  phonenumber: "phoneNumber",
  phone: "phoneNumber",
  password: "password",
  confirmpassword: "confirmPassword",
};

/** Map backend validation keys onto registration form field keys. */
export function mapRegisterApiFieldErrors(
  error: ApiError,
): Partial<Record<"fullName" | "email" | "phoneNumber" | "password" | "confirmPassword", string>> {
  const mapped: Partial<
    Record<"fullName" | "email" | "phoneNumber" | "password" | "confirmPassword", string>
  > = {};

  for (const [key, messages] of Object.entries(error.fieldErrors)) {
    const normalized = key.toLowerCase().replace(/\./g, "");
    const field = REGISTER_FIELD_ALIASES[normalized];
    if (!field || !messages[0]) continue;
    mapped[field as keyof typeof mapped] = messages[0];
  }

  return mapped;
}

const LOGIN_FIELD_ALIASES: Record<string, "identifier" | "password"> = {
  identifier: "identifier",
  email: "identifier",
  phone: "identifier",
  phonenumber: "identifier",
  password: "password",
};

/** Map backend login validation keys onto login form fields (US-LOGIN-02). */
export function mapLoginApiFieldErrors(
  error: ApiError,
): Partial<Record<"identifier" | "password", string>> {
  const mapped: Partial<Record<"identifier" | "password", string>> = {};

  for (const [key, messages] of Object.entries(error.fieldErrors)) {
    const normalized = key.toLowerCase().replace(/\./g, "");
    const field = LOGIN_FIELD_ALIASES[normalized];
    if (!field || !messages[0]) continue;
    // Prefer first message; email/phone both target the shared identifier control.
    if (!mapped[field]) mapped[field] = messages[0];
  }

  return mapped;
}

/** Invalid login credentials (generic — never reveal whether the account exists). */
export function isInvalidLoginCredentialsError(error: ApiError): boolean {
  if (error.status === 401) return true;
  const text = `${error.code ?? ""} ${error.detail ?? ""} ${error.message}`.toLowerCase();
  return (
    text.includes("invalid identifier") ||
    text.includes("invalid identifiers") ||
    text.includes("invalid credentials") ||
    text.includes("unauthorized")
  );
}

/** Locked / temporarily blocked account (HTTP 422 + AccountBlocked). */
export function isAccountBlockedError(error: ApiError): boolean {
  if (error.code === "AccountBlocked") return true;
  if (error.status === 422) {
    const text = `${error.detail ?? ""} ${error.message}`.toLowerCase();
    return text.includes("blocked") || text.includes("lock");
  }
  return false;
}

/** Extract remaining lockout minutes from backend blocked-account message. */
export function getAccountBlockedMinutes(error: ApiError): number | null {
  const text = `${error.detail ?? ""} ${error.message}`;
  const match = text.match(/(\d+)\s*minute/i);
  if (!match) return null;
  const minutes = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

