import { apiOrigin } from "@/lib/api";

/** Browser origin of the API host (no `/api/v1`). Same source as REST + SignalR. */
export function apiMediaOrigin(): string {
  return apiOrigin();
}

/**
 * First non-empty media reference from backend field candidates.
 * Prefer cover fields (`mainImage` / `mainImageUrl`) before gallery photos —
 * cover is often stored only on MainImageUrl and is NOT duplicated in Photos.
 */
export function firstMediaReference(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }
  return null;
}

/** Extract URL strings from backend photo/gallery entries (`{ url }` or plain string). */
export function extractPhotoUrls(
  photos:
    | Array<{ url?: string | null } | string | null | undefined>
    | null
    | undefined,
): string[] {
  if (!photos?.length) return [];
  const urls: string[] = [];
  for (const entry of photos) {
    if (typeof entry === "string") {
      const value = entry.trim();
      if (value) urls.push(value);
      continue;
    }
    const value = entry?.url?.trim();
    if (value) urls.push(value);
  }
  return urls;
}

const UPLOADS_PREFIX = "/uploads/";

function isUploadsPath(pathname: string): boolean {
  return pathname.toLowerCase().startsWith(UPLOADS_PREFIX);
}

/**
 * API-relative upload path (`/uploads/...` plus query) when `url` references a
 * file served by the API `/uploads` static mount — whether it was stored relative
 * or pinned to some absolute origin. Frontend counterpart of the backend
 * `HallMediaUrl.NormalizePersistedUrl` rule (Edit 29): legacy rows persisted an
 * absolute display URL, so the stored origin may belong to a retired deployment
 * and must never decide where the browser fetches from.
 *
 * Returns `null` for anything else (external CDN URL, blob:, frontend-local asset).
 */
export function apiUploadPath(url: string | null | undefined): string | null {
  const value = url?.trim();
  if (!value) return null;
  if (isUploadsPath(value)) return value;
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const parsed = new URL(value);
    return isUploadsPath(parsed.pathname) ? `${parsed.pathname}${parsed.search}` : null;
  } catch {
    return null;
  }
}

/**
 * Resolves a persisted hall media URL into a browser-ready URL.
 *
 * The backend stores and returns hall image paths as API-relative URLs
 * (`/uploads/halls/{hallId}/{fileName}`) and serves them from the API origin
 * (`/uploads` static-file mount). They MUST be prefixed with the API origin,
 * otherwise the browser resolves them against the frontend origin and they 404.
 *
 * - Any `/uploads/...` reference (relative, or absolute from any origin) is
 *   re-anchored to the configured API origin — see {@link apiUploadPath}.
 * - Other absolute http(s) and blob: URLs pass through unchanged.
 * - Any other relative path is treated as a frontend-local asset (e.g.
 *   `public/halls/featured-*.webp` fallbacks) and returned as-is.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  const value = url?.trim();
  if (!value) return "";
  const uploadPath = apiUploadPath(value);
  if (uploadPath) return `${apiMediaOrigin()}${uploadPath}`;
  return value;
}
