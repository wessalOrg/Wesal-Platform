import axios from "axios";
import { ApiError } from "@/lib/api-error";
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
    const message =
      error.response?.data?.message || error.message || "Request failed";
    const status =
      typeof error.response?.status === "number"
        ? error.response.status
        : undefined;
    return Promise.reject(new ApiError(message, status));
  },
);

export default api;
