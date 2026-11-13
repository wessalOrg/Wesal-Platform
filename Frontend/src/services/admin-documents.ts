import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";
import { isDemoModeEnabled } from "@/lib/demo-mode";

function usesMock(): boolean {
  if (!isDemoModeEnabled()) return false;
  const token = getAccessToken();
  return !token || token.startsWith("stub-");
}

/** Soft placeholder images for local demo admin review layouts. */
function createDemoImageDocument(
  label: string,
  from: string,
  to: string,
): AdminSecureDocument {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="960" height="720" fill="url(#g)"/>
  <rect x="48" y="48" width="864" height="624" rx="28" fill="rgba(255,255,255,0.18)"/>
  <text x="480" y="370" text-anchor="middle" fill="rgba(255,255,255,0.95)" font-family="Tahoma, Arial, sans-serif" font-size="42" font-weight="700">${label}</text>
</svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  return { url: URL.createObjectURL(blob), mimeType: "image/svg+xml" };
}

const DEMO_WORK_PALETTE: Array<{ label: string; from: string; to: string }> = [
  { label: "قاعة أفراح", from: "#c48b8b", to: "#8f5a5a" },
  { label: "تزيين طاولة", from: "#d4a5a5", to: "#a56b6b" },
  { label: "ورود", from: "#b97878", to: "#7d4a4a" },
  { label: "تفاصيل", from: "#cfa0a0", to: "#946060" },
  { label: "جلسة تصوير", from: "#c99595", to: "#855555" },
];

function demoCoordinatorWorkPhoto(index: number): AdminSecureDocument {
  const tone = DEMO_WORK_PALETTE[(index - 1) % DEMO_WORK_PALETTE.length]!;
  return createDemoImageDocument(tone.label, tone.from, tone.to);
}

function demoCoordinatorIdentity(): AdminSecureDocument {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560">
  <rect width="900" height="560" rx="24" fill="#f4ece8"/>
  <rect x="36" y="36" width="828" height="488" rx="18" fill="#fff" stroke="#e2d6d1" stroke-width="3"/>
  <rect x="70" y="90" width="210" height="260" rx="14" fill="#e8ddd8"/>
  <circle cx="175" cy="175" r="48" fill="#d2c0b8"/>
  <rect x="120" y="250" width="110" height="14" rx="7" fill="#d2c0b8"/>
  <rect x="330" y="120" width="480" height="22" rx="11" fill="#dccfc9"/>
  <rect x="330" y="170" width="360" height="18" rx="9" fill="#e7dbd5"/>
  <rect x="330" y="220" width="400" height="18" rx="9" fill="#e7dbd5"/>
  <rect x="330" y="270" width="300" height="18" rx="9" fill="#e7dbd5"/>
  <rect x="330" y="340" width="220" height="70" rx="12" fill="#f0e4df"/>
  <text x="450" y="480" text-anchor="middle" fill="#9a7b72" font-family="Tahoma, Arial, sans-serif" font-size="28" font-weight="700">هوية تجريبية</text>
</svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  return { url: URL.createObjectURL(blob), mimeType: "image/svg+xml" };
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

const ADMIN_COORDINATOR_IDENTITY_PATH = (userId: string) =>
  `/admin/coordinators/${encodeURIComponent(userId)}/identity-document`;

const ADMIN_COORDINATOR_SHOP_PHOTO_PATH = (userId: string) =>
  `/admin/coordinators/${encodeURIComponent(userId)}/shop-photo`;

const ADMIN_COORDINATOR_WORK_PHOTO_PATH = (userId: string, index: 1 | 2) =>
  `/admin/coordinators/${encodeURIComponent(userId)}/work-photos/${index}`;

/** GET /api/v1/admin/coordinators/{userId}/identity-document */
export async function fetchAdminCoordinatorIdentityUrl(
  userId: string,
): Promise<AdminSecureDocument | null> {
  if (usesMock()) {
    void userId;
    return demoCoordinatorIdentity();
  }
  return fetchAdminDocument(
    ADMIN_COORDINATOR_IDENTITY_PATH(userId),
    "admin.coordinators.detail.docs.errors.loadFailed",
  );
}

/** GET /api/v1/admin/coordinators/{userId}/shop-photo */
export async function fetchAdminCoordinatorShopPhotoUrl(
  userId: string,
): Promise<AdminSecureDocument | null> {
  if (usesMock()) {
    void userId;
    return createDemoImageDocument("صورة المحل", "#c48b8b", "#8f5a5a");
  }
  return fetchAdminDocument(
    ADMIN_COORDINATOR_SHOP_PHOTO_PATH(userId),
    "admin.coordinators.detail.docs.errors.loadFailed",
  );
}

/** GET /api/v1/admin/coordinators/{userId}/work-photos/{index} */
export async function fetchAdminCoordinatorWorkPhotoUrl(
  userId: string,
  index: 1 | 2,
): Promise<AdminSecureDocument | null> {
  if (usesMock()) {
    void userId;
    return demoCoordinatorWorkPhoto(index);
  }
  return fetchAdminDocument(
    ADMIN_COORDINATOR_WORK_PHOTO_PATH(userId, index),
    "admin.coordinators.detail.docs.errors.loadFailed",
  );
}

/** Extra demo gallery frames so the mosaic matches the review mockup locally. */
export async function fetchDemoCoordinatorGalleryFrame(
  index: number,
): Promise<AdminSecureDocument | null> {
  if (!usesMock()) return null;
  return demoCoordinatorWorkPhoto(index);
}

const ADMIN_PHOTOGRAPHER_IDENTITY_PATH = (userId: string) =>
  `/admin/photographers/${encodeURIComponent(userId)}/identity-document`;

/** GET /api/v1/admin/photographers/{userId}/identity-document */
export async function fetchAdminPhotographerIdentityUrl(
  userId: string,
): Promise<AdminSecureDocument | null> {
  if (usesMock()) {
    void userId;
    return demoCoordinatorIdentity();
  }
  return fetchAdminDocument(
    ADMIN_PHOTOGRAPHER_IDENTITY_PATH(userId),
    "admin.photographers.detail.docs.errors.loadFailed",
  );
}
