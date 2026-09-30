/**
 * Production environment gate for the Vercel build (runs as `prebuild`).
 *
 * - Vercel production deploys (VERCEL_ENV=production) MUST configure a valid
 *   absolute https NEXT_PUBLIC_API_BASE_URL, otherwise browsers would silently
 *   target localhost or an invalid origin.
 * - NEXT_PUBLIC_DEMO_MODE must NEVER be "true" on a production deploy,
 *   otherwise the site would serve fabricated demo data as if real.
 * - Any other environment (dev, preview, CI without Vercel context) only warns.
 */
const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();
const demoMode = (process.env.NEXT_PUBLIC_DEMO_MODE ?? "").trim();
const vercelEnv = (process.env.VERCEL_ENV ?? "").trim();
const failures = [];

if (vercelEnv === "production") {
  if (!apiBase) {
    failures.push("NEXT_PUBLIC_API_BASE_URL is missing for the production deploy.");
  } else {
    let url = null;
    try {
      url = new URL(apiBase);
    } catch {
      url = null;
    }
    if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) {
      failures.push(`NEXT_PUBLIC_API_BASE_URL is not a valid absolute http(s) URL: "${apiBase}".`);
    } else if (url.protocol !== "https:") {
      failures.push("NEXT_PUBLIC_API_BASE_URL must use https in production.");
    }
  }
  if (demoMode === "true") {
    failures.push('NEXT_PUBLIC_DEMO_MODE must not be "true" on a production deploy.');
  }
} else {
  if (!apiBase) {
    console.warn("[verify-production-env] NEXT_PUBLIC_API_BASE_URL not set; development fallback (localhost) applies.");
  }
  if (demoMode === "true") {
    console.warn("[verify-production-env] NEXT_PUBLIC_DEMO_MODE=true (demo fallbacks enabled; never use in production).");
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`[verify-production-env] ERROR: ${failure}`);
  process.exit(1);
}
console.log("[verify-production-env] OK");
