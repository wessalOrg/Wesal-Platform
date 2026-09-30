import axios from "axios";
import { ApiError, parseApiFieldErrors } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";
import {
  DEV_API_BASE_URL,
  PROD_API_BASE_URL,
  validateApiBaseUrl,
} from "@/lib/api-base-url.mjs";

/**
 * Resolves the backend base URL (production hardening).
 * Order: explicit NEXT_PUBLIC_API_BASE_URL (validated) -> canonical Wesal API in
 * production -> localhost in development. Production never falls back to
 * localhost, and an invalid explicit value fails loudly.
 *
 * `process.env.*` reads stay literal so Next.js inlines them at build time; the
 * fallback ternary then folds away the unused branch, keeping the localhost URL
 * out of production client bundles. Runtime https/localhost checks only see
 * VERCEL_ENV on the server — `scripts/verify-production-env.mjs` (prebuild) is
 * the authoritative gate for the browser bundle.
 */
export function resolveApiBaseUrl(): string {
  const explicit = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();
  if (explicit) return validateApiBaseUrl(explicit, process.env.VERCEL_ENV);
  return process.env.NODE_ENV === "production" ? PROD_API_BASE_URL : DEV_API_BASE_URL;
}

/** Effective REST base URL (`.../api/v1`), validated for the current environment. */
export function apiBaseUrl(): string {
  return resolveApiBaseUrl();
}

/** Origin of the API host (no `/api/v1`), used for `/uploads` media and SignalR hubs. */
export function apiOrigin(): string {
  return new URL(apiBaseUrl()).origin;
}

const api = axios.create({
  baseURL: apiBaseUrl(),
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 8000,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data;
    const fieldErrors = parseApiFieldErrors(data);
    const firstFieldMessage = Object.values(fieldErrors)[0]?.[0];
    const detail = typeof data?.detail === "string" ? data.detail : undefined;
    const code =
      typeof data?.code === "string"
        ? data.code
        : typeof data?.extensions?.code === "string"
          ? data.extensions.code
          : undefined;
    const message =
      (typeof data?.message === "string" && data.message) ||
      detail ||
      (typeof data?.title === "string" && data.title) ||
      firstFieldMessage ||
      error.message ||
      "Request failed";
    const status =
      typeof error.response?.status === "number"
        ? error.response.status
        : undefined;
    return Promise.reject(
      new ApiError(message, status, fieldErrors, { detail, code, details: data }),
    );
  },
);

export default api;
