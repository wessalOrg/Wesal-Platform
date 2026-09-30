/**
 * Explicit demo-mode gate (production hardening).
 *
 * Demo/mock fallbacks across the services layer (fake halls, fake bookings,
 * fake reviews, fake success results) run ONLY when this returns true.
 *
 * Enabled exclusively via `NEXT_PUBLIC_DEMO_MODE === "true"`, which must NEVER
 * be set in production: without it, missing tokens or API failures surface as
 * honest loading/error/unavailable states instead of fabricated data.
 */
export function isDemoModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}
