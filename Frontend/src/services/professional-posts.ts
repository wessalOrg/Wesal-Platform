import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { mapProfessionalProfileContentItem } from "@/lib/professional-profile-mapper";
import type { ProfessionalProfileContentItem } from "@/types/professional-profile";

const UPLOAD_TIMEOUT_MS = 60_000;

function stripFormContentType(body: unknown, headers: Record<string, unknown>) {
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    delete headers["Content-Type"];
  }
  return body;
}

export type CreateProfessionalPostInput = {
  content: string;
  price: number | null;
  images: File[];
};

export type UpdateProfessionalPostInput = {
  content: string;
  price: number | null;
  /** When true, only keepImageIds are retained and new images are appended. */
  replaceImages: boolean;
  keepImageIds: string[];
  images: File[];
};

/** POST /api/v1/posts — multipart; returns created post id. */
export async function createProfessionalPost(
  input: CreateProfessionalPostInput,
): Promise<string> {
  const formData = new FormData();
  const content = input.content.trim();
  if (content) formData.append("content", content);
  if (input.price != null) formData.append("price", String(input.price));
  for (const file of input.images) {
    formData.append("images", file, file.name);
  }
  try {
    const { data } = await api.post<unknown>("/posts", formData, {
      timeout: UPLOAD_TIMEOUT_MS,
      transformRequest: [stripFormContentType],
    });
    const id = readCreatedId(data);
    if (!id) throw new ApiError("professionals.posts.errors.createFailed", 0);
    return id;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("professionals.posts.errors.createFailed", 0);
  }
}

/** PUT /api/v1/posts/{postId} — multipart; 204 on success. */
export async function updateProfessionalPost(
  postId: string,
  input: UpdateProfessionalPostInput,
): Promise<void> {
  const formData = new FormData();
  formData.append("content", input.content.trim());
  if (input.price != null) formData.append("price", String(input.price));
  formData.append("replaceImages", input.replaceImages ? "true" : "false");
  if (input.replaceImages) {
    for (const id of input.keepImageIds) {
      formData.append("keepImageIds", id);
    }
  }
  for (const file of input.images) {
    formData.append("images", file, file.name);
  }
  try {
    await api.put(`/posts/${encodeURIComponent(postId)}`, formData, {
      timeout: UPLOAD_TIMEOUT_MS,
      transformRequest: [stripFormContentType],
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("professionals.posts.errors.updateFailed", 0);
  }
}

/** GET /api/v1/posts/{postId} */
export async function fetchProfessionalPost(
  postId: string,
): Promise<ProfessionalProfileContentItem> {
  const { data } = await api.get<unknown>(
    `/posts/${encodeURIComponent(postId)}`,
    { timeout: 10000 },
  );
  const mapped = mapProfessionalProfileContentItem(data);
  if (!mapped) throw new ApiError("professionals.posts.errors.loadFailed", 0);
  return mapped;
}

function readCreatedId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const dto = payload as Record<string, unknown>;
  const raw = dto.id ?? dto.Id;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return null;
}
