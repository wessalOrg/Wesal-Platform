/** Mirrors Backend RegisterRequestValidator limits/rules (US-REG-02). */
export const REGISTER_LIMITS = {
  maxFullNameLength: 150,
  maxEmailLength: 256,
  maxPhoneLength: 30,
  minPasswordLength: 8,
  maxPasswordLength: 128,
} as const;

/** Local PS mobiles like 0595988398 (10 digits, leading 0). */
const LOCAL_PS_MOBILE = /^0(5\d{8})$/;
/** International compact form accepted by backend: +970599123456 */
const INTL_COMPACT = /^\+?[1-9]\d{7,14}$/;
const LOOSE_PHONE = /^\+?[0-9][0-9\s-]{6,19}$/;

export function isValidRegisterPhone(phone: string): boolean {
  const value = phone.trim();
  if (!value || value.length > REGISTER_LIMITS.maxPhoneLength) return false;

  // Common local Gaza/West Bank mobile entry
  if (LOCAL_PS_MOBILE.test(value)) return true;

  if (!LOOSE_PHONE.test(value)) return false;

  if (!value.includes(" ") && !value.includes("-")) {
    return INTL_COMPACT.test(value);
  }

  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

/**
 * Normalize for backend contract (expects +[1-9]... without a leading trunk 0).
 * Example: 0595988398 → +970595988398
 */
export function normalizeRegisterPhone(phone: string): string {
  const value = phone.trim();
  const localMatch = value.match(LOCAL_PS_MOBILE);
  if (localMatch) return `+970${localMatch[1]}`;

  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("970") && digits.length >= 12) return `+${digits}`;
  if (value.startsWith("+")) return `+${digits}`;
  if (INTL_COMPACT.test(value.replace(/[\s-]/g, ""))) {
    return value.startsWith("+") ? `+${digits}` : `+${digits}`;
  }
  return value.startsWith("+") ? `+${digits}` : value;
}

export type RegisterPasswordIssue =
  | "required"
  | "min"
  | "max"
  | "upper"
  | "lower"
  | "digit"
  | "special";

export function getRegisterPasswordIssue(password: string): RegisterPasswordIssue | null {
  if (!password) return "required";
  if (password.length < REGISTER_LIMITS.minPasswordLength) return "min";
  if (password.length > REGISTER_LIMITS.maxPasswordLength) return "max";
  if (!/[A-Z]/.test(password)) return "upper";
  if (!/[a-z]/.test(password)) return "lower";
  if (!/\d/.test(password)) return "digit";
  if (!/[^A-Za-z0-9]/.test(password)) return "special";
  return null;
}
