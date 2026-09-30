import axios from "axios";
import { ApiError, parseApiFieldErrors } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";

const DEV_API_BASE_URL = "http://localhost:5298/api/v1";

/**
 * Resolves the backend base URL (production hardening).
 * Development keeps the localhost fallback; a production bundle with a missing
 * or invalid NEXT_PUBLIC_API_BASE_URL fails loudly instead of pointing users'
 * browsers at localhost.
 */
export function resolveApiBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "NEXT_PUBLIC_API_BASE_URL is not configured. Set it to the deployed API origin (e.g. https://wesal-platform.onrender.com/api/v1).",
      );
    }
    return DEV_API_BASE_URL;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_API_BASE_URL is not a valid absolute URL: "${raw}".`,
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `NEXT_PUBLIC_API_BASE_URL must use http(s): "${raw}".`,
    );
  }
  // HTTPS is required on Vercel production only: local production builds
  // (NODE_ENV=production without VERCEL_ENV) may still target http localhost.
  if (process.env.VERCEL_ENV === "production" && url.protocol !== "https:") {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL must use https in production.",
    );
  }
  return raw;
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
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
