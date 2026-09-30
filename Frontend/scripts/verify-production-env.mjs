/**
 * Production environment gate for the Vercel build (runs as `prebuild`).
 *
 * - NEXT_PUBLIC_API_BASE_URL is OPTIONAL on production deploys: when it is
 *   missing, the canonical Wesal API (https://wesal-platform.onrender.com/api/v1)
 *   is used, so deployments do not depend on dashboard-only configuration.
 * - An explicitly provided value must be a valid absolute https URL (not
 *   localhost) on a production deploy, otherwise the build fails.
 * - NEXT_PUBLIC_DEMO_MODE must NEVER be "true" on a production deploy,
 *   otherwise the site would serve fabricated demo data as if real.
 * - An explicit NEXT_PUBLIC_API_BASE_URL that is malformed fails in EVERY
 *   environment; outside production deploys a missing value or demo mode only warns.
 * - Preview deploys with no URL also use the canonical (production) API; set a
 *   Preview-scoped NEXT_PUBLIC_API_BASE_URL to point previews elsewhere.
 *
 * The rules live in src/lib/api-base-url.mjs, shared with the app runtime.
 */
import { evaluateFrontendEnv } from "../src/lib/api-base-url.mjs";

const { failures, warnings, notes } = evaluateFrontendEnv(process.env);

for (const note of notes) console.log(`[verify-production-env] ${note}`);
for (const warning of warnings) console.warn(`[verify-production-env] ${warning}`);

if (failures.length > 0) {
  for (const failure of failures) console.error(`[verify-production-env] ERROR: ${failure}`);
  process.exit(1);
}
console.log("[verify-production-env] OK");
