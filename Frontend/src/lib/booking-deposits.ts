/** Mirrors Backend BookingDeposits. */
export const BOOKING_DEPOSIT_MIN = 0.01;
export const BOOKING_DEPOSIT_MAX = 1_000_000;

export function parseDepositAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export function isValidDepositAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount >= BOOKING_DEPOSIT_MIN && amount <= BOOKING_DEPOSIT_MAX;
}

export function formatDepositAmount(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : String(Number(amount.toFixed(2)));
}
