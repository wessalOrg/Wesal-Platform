import {
  isValidRegisterPhone,
  normalizeRegisterPhone,
} from "@/lib/register-validation";

export type LoginIdentifierKind = "email" | "phone";

export function detectLoginIdentifierKind(identifier: string): LoginIdentifierKind {
  return identifier.trim().includes("@") ? "email" : "phone";
}

/** Soft email check — must include @ and a domain-ish part, without over-rejecting. */
export function isValidLoginEmail(email: string): boolean {
  const value = email.trim();
  if (!value || value.length > 256) return false;
  if (!value.includes("@")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidLoginIdentifier(identifier: string): boolean {
  const value = identifier.trim();
  if (!value) return false;
  return detectLoginIdentifierKind(value) === "email"
    ? isValidLoginEmail(value)
    : isValidRegisterPhone(value);
}

/** Normalize phone identifiers for backend lookup; leave emails unchanged. */
export function normalizeLoginIdentifier(identifier: string): string {
  const value = identifier.trim();
  if (!value) return value;
  if (detectLoginIdentifierKind(value) === "email") return value;
  return normalizeRegisterPhone(value);
}
