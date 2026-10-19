/**
 * Single source of truth for the backend API base URL and the production
 * environment gate. Plain ESM so both the app (`src/lib/api.ts`) and the
 * Node-only build scripts (`scripts/verify-*.mjs`) share one implementation.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_API_BASE_URL, when set (validated).
 *   2. Production build, variable missing  -> canonical Wesal API (public, not a secret).
 *   3. Development, variable missing       -> local API.
 *
 * Production never falls back to localhost and never enables demo mode.
 */

/** Local API used only when NODE_ENV is not "production". */
export const DEV_API_BASE_URL = "http://localhost:5298/api/v1";

/** Canonical public Wesal API (Render). Public configuration, not a secret. */
export const PROD_API_BASE_URL = "https://wesal-platform-p0iv.onrender.com/api/v1";

/** True for loopback / unspecified hosts that must never be a production API. */
function isLocalHostname(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "[::]" || host === "[::1]" || host.startsWith("[::ffff:")) return true;
  // WHATWG URL normalizes every IPv4 spelling (127.1, 0x7f.1, decimal) to dotted quad.
  return host === "0.0.0.0" || /^127\./.test(host);
}

/**
 * Validates an explicitly configured API base URL.
 *
 * @param {string} raw non-empty, trimmed value of NEXT_PUBLIC_API_BASE_URL
 * @param {string | null | undefined} vercelEnv
 * @returns {string} the validated value
 * @throws {Error} when the value is invalid for the environment
 */
export function validateApiBaseUrl(raw, vercelEnv) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`NEXT_PUBLIC_API_BASE_URL is not a valid absolute URL: "${raw}".`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`NEXT_PUBLIC_API_BASE_URL must use http(s): "${raw}".`);
  }
  // Reject spellings WHATWG URL silently repairs ("https:/host", "https:\host"):
  // the raw string is what axios receives, and it would fail on every request.
  if (!/^https?:\/\//i.test(raw)) {
    throw new Error(`NEXT_PUBLIC_API_BASE_URL must be written as "scheme://host/...": "${raw}".`);
  }
  if (url.username || url.password) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must not embed credentials (it ships in the public bundle).");
  }
  // Strict rules apply to Vercel production deploys only: local production
  // builds (NODE_ENV=production without VERCEL_ENV, e.g. CI) may still target
  // an http localhost API.
  if ((vercelEnv ?? "").trim() === "production") {
    if (url.protocol !== "https:") {
      throw new Error("NEXT_PUBLIC_API_BASE_URL must use https in production.");
    }
    if (isLocalHostname(url.hostname)) {
      throw new Error("NEXT_PUBLIC_API_BASE_URL must not point at localhost in production.");
    }
  }
  return raw;
}

/**
 * Default API when NEXT_PUBLIC_API_BASE_URL is missing.
 * @param {string | null | undefined} nodeEnv
 */
export function fallbackApiBaseUrl(nodeEnv) {
  return (nodeEnv ?? "").trim() === "production" ? PROD_API_BASE_URL : DEV_API_BASE_URL;
}

/**
 * Full resolution (validation + fallback). Used by tests and the prebuild gate;
 * `src/lib/api.ts` composes the same two helpers inline so the bundler can
 * eliminate the development URL from production client bundles.
 *
 * @param {ApiBaseUrlInput} input
 * @returns {{ value: string, source: "env" | "canonical" | "development" }}
 * @throws {Error} when an explicitly configured value is invalid for the environment.
 */
export function resolveApiBaseUrlFrom(input) {
  const raw = (input.apiBaseUrl ?? "").trim();
  if (raw) {
    return { value: validateApiBaseUrl(raw, input.vercelEnv), source: "env" };
  }
  const value = fallbackApiBaseUrl(input.nodeEnv);
  return { value, source: value === PROD_API_BASE_URL ? "canonical" : "development" };
}

/**
 * Production gate used by `scripts/verify-production-env.mjs` (prebuild).
 *
 * @param {Record<string, string | undefined>} env
 * @returns {{
 *   failures: string[],
 *   warnings: string[],
 *   notes: string[],
 *   isProductionDeploy: boolean,
 *   api: { value: string, source: string } | null,
 * }}
 */
export function evaluateFrontendEnv(env) {
  const vercelEnv = (env.VERCEL_ENV ?? "").trim();
  const demoMode = (env.NEXT_PUBLIC_DEMO_MODE ?? "").trim();
  const isProductionDeploy = vercelEnv === "production";
  const failures = [];
  const warnings = [];
  const notes = [];

  let api = null;
  try {
    api = resolveApiBaseUrlFrom({
      apiBaseUrl: env.NEXT_PUBLIC_API_BASE_URL,
      // The gate runs as `prebuild`; `next build` keeps a pre-set NODE_ENV and
      // only defaults to "production" when it is empty.
      nodeEnv: (env.NODE_ENV ?? "").trim() || "production",
      vercelEnv,
    });
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }

  if (isProductionDeploy) {
    if (api?.source === "canonical") {
      notes.push(`Using canonical production API: ${api.value}`);
    }
    if (api?.source === "development") {
      failures.push(
        `A production deploy with NODE_ENV="${(env.NODE_ENV ?? "").trim()}" would bundle the localhost API. Remove the NODE_ENV override or set NEXT_PUBLIC_API_BASE_URL.`,
      );
    }
    if (demoMode === "true") {
      failures.push('NEXT_PUBLIC_DEMO_MODE must not be "true" on a production deploy.');
    }
  } else {
    if (api?.source === "canonical") {
      warnings.push(
        `NEXT_PUBLIC_API_BASE_URL not set; this build will use the canonical production API (${api.value}).`,
      );
    }
    if (demoMode === "true") {
      warnings.push("NEXT_PUBLIC_DEMO_MODE=true (demo fallbacks enabled; never use in production).");
    }
  }

  return { failures, warnings, notes, isProductionDeploy, api };
}
