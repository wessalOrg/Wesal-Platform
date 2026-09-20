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

async function fetchAdminDocument(
  path: string,
  notFoundErrorKey: string,
  loadErrorKey: string,
): Promise<string | null> {
  if (usesMock()) return null;

  try {
    const { data } = await api.get<Blob>(path, {
      responseType: "blob",
      timeout: 20000,
    });
    if (!data || (typeof Blob !== "undefined" && data.size === 0)) return null;
    return URL.createObjectURL(data);
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
 * Returns the document as an object URL, or null when no receipt exists (404).
 */
export async function fetchAdminPaymentReceiptUrl(
  hallId: string,
): Promise<string | null> {
  return fetchAdminDocument(
    ADMIN_PAYMENT_RECEIPT_PATH(hallId),
    "admin.halls.details.receipt.missing",
    "admin.halls.details.receipt.errors.loadFailed",
  );
}

/**
 * Streams a Hall Owner's identity document (Admin only).
 * GET /api/v1/admin/halls/owners/{ownerId}/identity-document
 * Returns the document as an object URL, or null when none exists (404).
 */
export async function fetchAdminOwnerIdentityUrl(
  ownerId: string,
): Promise<string | null> {
  return fetchAdminDocument(
    ADMIN_OWNER_IDENTITY_PATH(ownerId),
    "admin.halls.details.identity.missing",
    "admin.halls.details.identity.errors.loadFailed",
  );
}