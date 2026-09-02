import axios from "axios";
import { ApiError, parseApiFieldErrors } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";

const api = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5298/api/v1",
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
      new ApiError(message, status, fieldErrors, { detail, code }),
    );
  },
);

export default api;
