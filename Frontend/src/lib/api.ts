import axios from "axios";
import { ApiError, parseApiFieldErrors } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";

/** Local dev default only; deployments must set NEXT_PUBLIC_API_BASE_URL. */
const DEV_API_BASE_URL = "http://localhost:5298/api/v1";

/** Effective REST base URL (`.../api/v1`), env-driven. */
export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || DEV_API_BASE_URL;
}

/** Origin of the API host (no `/api/v1`), used for `/uploads` media and SignalR hubs. */
export function apiOrigin(): string {
  try {
    return new URL(apiBaseUrl()).origin;
  } catch {
    return new URL(DEV_API_BASE_URL).origin;
  }
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
