import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";

function usesMock(): boolean {
  const token = getAccessToken();
  return !token || token.startsWith("stub-");
}

export const ADMIN_PAYMENT_RECEIPT_PATH = (hallId: string) =>
  `/admin/halls/${encodeURIComponent(hallId)}/payment-receipt`;

export const ADMIN_OWNER_IDENTITY_PATH = (ownerId: string) =>
  `/admin/halls/owners/${encodeURIComponent(ownerId)}/identity-document`;

export type AdminSecureDocument = {
  url: string;
  mimeType: string;
};

async function fetchAdminDocument(
  path: string,
  loadErrorKey: string,
): Promise<AdminSecureDocument | null> {
  if (usesMock()) return null;

  try {
    const response = await api.get<Blob>(path, {
      responseType: "blob",
      timeout: 20000,
    });
    const data = response.data;
    if (!data || (typeof Blob !== "undefined" && data.size === 0)) return null;

    const headerType =
      typeof response.headers?.["content-type"] === "string"
        ? response.headers["content-type"].split(";")[0]?.trim()
        : "";
    const mimeType = (data.type || headerType || "").toLowerCase();
    const blob =
      mimeType && data.type !== mimeType
        ? new Blob([data], { type: mimeType })
        : data;

    return {
      url: URL.createObjectURL(blob),
      mimeType: blob.type || mimeType,
    };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) return null;
      throw err;
    }
    throw new ApiError(
      err instanceof Error ? err.message : loadErrorKey,
      0,
    );
  }
}

/**
 * Streams the payment receipt the owner uploaded for a hall (Admin only).
 * GET /api/v1/admin/halls/{hallId}/payment-receipt
 */
export async function fetchAdminPaymentReceiptUrl(
  hallId: string,
): Promise<AdminSecureDocument | null> {
  return fetchAdminDocument(
    ADMIN_PAYMENT_RECEIPT_PATH(hallId),
    "admin.halls.details.receipt.errors.loadFailed",
  );
}

/**
 * Streams a Hall Owner's identity document (Admin only).
 * GET /api/v1/admin/halls/owners/{ownerId}/identity-document
 */
export async function fetchAdminOwnerIdentityUrl(
  ownerId: string,
): Promise<AdminSecureDocument | null> {
  return fetchAdminDocument(
    ADMIN_OWNER_IDENTITY_PATH(ownerId),
    "admin.halls.details.identity.errors.loadFailed",
  );
}
