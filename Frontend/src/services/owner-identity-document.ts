import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";

export const IDENTITY_DOCUMENT_PATH = "/owner/profile/identity-document";

export type IdentityDocumentUploadResult = {
  uploadedAt: string | null;
  hasDocument: boolean;
};

function usesMock(): boolean {
  const token = getAccessToken();
  return !token || token.startsWith("stub-");
}

/**
 * Uploads the Hall Owner's identity document (US-OWNER-30).
 * Multipart field name is `file`; document must be jpg/jpeg/png/webp/pdf ≤5MB.
 * POST /api/v1/owner/profile/identity-document
 */
export async function uploadIdentityDocument(
  file: File,
): Promise<IdentityDocumentUploadResult> {
  if (usesMock()) {
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    return { uploadedAt: new Date().toISOString(), hasDocument: true };
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const { data, status } = await api.post<IdentityDocumentUploadResult | "">(
      IDENTITY_DOCUMENT_PATH,
      formData,
      {
        timeout: 60000,
        transformRequest: [
          (body, headers) => {
            if (typeof FormData !== "undefined" && body instanceof FormData) {
              if (headers && typeof headers === "object") {
                delete (headers as Record<string, unknown>)["Content-Type"];
              }
            }
            return body;
          },
        ],
      },
    );
    if (status === 204) {
      return { uploadedAt: null, hasDocument: true };
    }
    if (!data || typeof data === "string") {
      return { uploadedAt: null, hasDocument: true };
    }
    return {
      uploadedAt: String(data.uploadedAt ?? "").trim() || null,
      hasDocument: Boolean(data.hasDocument),
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "owner.management.identity.errors.uploadFailed",
      0,
    );
  }
}

/**
 * Streams the owner's own identity document as a preview object URL.
 * Returns null when no document exists (backend 404).
 * GET /api/v1/owner/profile/identity-document
 */
export async function fetchIdentityDocumentUrl(): Promise<string | null> {
  if (usesMock()) return null;

  try {
    const { data } = await api.get<Blob>(IDENTITY_DOCUMENT_PATH, {
      responseType: "blob",
      timeout: 15000,
    });
    if (!data || (typeof Blob !== "undefined" && data.size === 0)) return null;
    return URL.createObjectURL(data);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) return null;
      throw err;
    }
    throw new ApiError(
      err instanceof Error ? err.message : "owner.management.identity.errors.loadFailed",
      0,
    );
  }
}