const DEFAULT_API_BASE = "http://localhost:5298/api/v1";

export function apiMediaOrigin(): string {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE;
  return apiBase.replace(/\/api\/v1\/?$/i, "");
}

/**
 * Resolves a persisted hall media URL into a browser-ready URL.
 *
 * The backend stores and returns hall image paths as API-relative URLs
 * (`/uploads/halls/{hallId}/{fileName}`) and serves them from the API origin
 * (`/uploads` static-file mount). They MUST be prefixed with the API origin,
 * otherwise the browser resolves them against the frontend origin and they 404.
 *
 * - Absolute http(s) and blob: URLs pass through unchanged.
 * - `/uploads/...` paths are prefixed with the API origin.
 * - Any other relative path is treated as a frontend-local asset (e.g.
 *   `public/halls/featured-*.webp` fallbacks) and returned as-is.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  const value = url?.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("blob:")) return value;
  if (value.startsWith("/uploads/")) {
    return `${apiMediaOrigin()}${value}`;
  }
  return value;
}