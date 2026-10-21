/** Mirrors Backend BookingDeposits. */
export const BOOKING_DEPOSIT_MIN = 0.01;
export const BOOKING_DEPOSIT_MAX = 1_000_000;

const EASTERN_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const WESTERN_DIGITS = "0123456789";

/** True when the string contains Eastern Arabic (٠-٩) digits. */
export function usesEasternArabicDigits(value: string): boolean {
  return /[٠-٩]/.test(value);
}

export function toWesternDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (digit) => WESTERN_DIGITS[EASTERN_DIGITS.indexOf(digit)] ?? digit);
}

export function toEasternArabicDigits(value: string): string {
  return value.replace(/[0-9]/g, (digit) => EASTERN_DIGITS[Number(digit)] ?? digit);
}

/** Format a money amount using the same digit script the user typed with. */
export function formatAmountMatchingInput(amount: number, inputSamples: string[]): string {
  const preferEastern = inputSamples.some((sample) => usesEasternArabicDigits(sample));
  const western = amount.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
  return preferEastern ? toEasternArabicDigits(western) : western;
}

export function parseDepositAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = toWesternDigits(value.trim())
    .replace(/[٬،]/g, "")
    .replace(",", ".");
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
