/**
 * Explicit demo-mode gate (production hardening).
 *
 * Demo/mock fallbacks across the services layer (fake halls, fake bookings,
 * fake reviews, fake success results) run ONLY when this returns true.
 *
 * Enabled only in local development with `NEXT_PUBLIC_DEMO_MODE === "true"`.
 * Production builds always disable it, even if a local env file enables it.
 * Missing tokens or API failures in production surface as
 * honest loading/error/unavailable states instead of fabricated data.
 */
export function isDemoModeEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}
