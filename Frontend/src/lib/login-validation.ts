/** Soft email check — must include @ and a domain-ish part, without over-rejecting. */
export function isValidLoginEmail(email: string): boolean {
  const value = email.trim();
  if (!value || value.length > 256) return false;
  if (!value.includes("@")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}