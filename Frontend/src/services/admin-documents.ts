import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";
import { isDemoModeEnabled } from "@/lib/demo-mode";

function usesMock(): boolean {
  if (!isDemoModeEnabled()) return false;
  const token = getAccessToken();
  return !token || token.startsWith("stub-");
}

export const ADMIN_OWNER_IDENTITY_PATH = (ownerId: string) =>
  `/admin/halls/owners/${encodeURIComponent(ownerId)}/identity-document`;

function headerContentType(headers: unknown): string {
  if (!headers || typeof headers !== "object") return "";
  const bag = headers as { get?: (name: string) => unknown };
  const fromGetter = typeof bag.get === "function" ? bag.get("content-type") : undefined;
  const raw =
    fromGetter ??
    (headers as Record<string, unknown>)["content-type"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return "";
  return value.split(";")[0]?.trim().toLowerCase() ?? "";
}

function isPreviewableMime(mimeType: string): boolean {
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

/** Reads the file signature when the response type is missing or generic. */
async function sniffDocumentMime(blob: Blob): Promise<string> {
  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    head.length >= 12 &&
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return "image/webp";
  }
  if (
    head.length >= 5 &&
    head[0] === 0x25 &&
    head[1] === 0x50 &&
    head[2] === 0x44 &&
    head[3] === 0x46
  ) {
    return "application/pdf";
  }
  return "";
}

async function resolveDocumentMime(blob: Blob, headers: unknown): Promise<string> {
  const headerType = headerContentType(headers);
  const blobType = blob.type.split(";")[0]?.trim().toLowerCase() ?? "";
  const declared = isPreviewableMime(headerType)
    ? headerType
    : isPreviewableMime(blobType)
      ? blobType
      : "";
  if (declared) return declared;

  const sniffed = await sniffDocumentMime(blob);
  return isPreviewableMime(sniffed) ? sniffed : "";
}

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

    const mimeType = await resolveDocumentMime(data, response.headers);
    if (!isPreviewableMime(mimeType)) {
      throw new ApiError(loadErrorKey, response.status);
    }

    const blob =
      data.type !== mimeType ? new Blob([data], { type: mimeType }) : data;

    return {
      url: URL.createObjectURL(blob),
      mimeType,
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
