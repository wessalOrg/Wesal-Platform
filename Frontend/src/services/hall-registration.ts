import { assertHallImages, HALL_CREATE_MAX_PHOTOS } from "@/lib/hall-image-validation";
import { readAuthenticatedAccount } from "@/lib/authenticated-account";
import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { CREATE_HALL_PATH } from "@/lib/hall-form-mapper";
import type { CreateHallResult } from "@/types/hall-registration";

type CreateHallResponseDto = {
  id?: string | null;
  hallId?: string | null;
};

function readHallId(data: CreateHallResponseDto | "" | null | undefined): string | null {
  if (!data || typeof data === "string") return null;
  const value = (data.hallId ?? data.id ?? "").trim();
  return value || null;
}

/**
 * Creates a hall listing for the authenticated Hall Owner.
 * Payload must be multipart FormData (see mapHallFormToCreateHallRequest).
 */
export async function createHall(formData: FormData): Promise<CreateHallResult> {
  const imageOwner = readAuthenticatedAccount();
  await assertHallImages(formData.get("mainPhoto") instanceof File ? formData.get("mainPhoto") as File : null,
    formData.getAll("photos").filter((value): value is File => value instanceof File), HALL_CREATE_MAX_PHOTOS);
  if (readAuthenticatedAccount() !== imageOwner) throw new ApiError("owner.management.addHall.errors.submitFailed", 0);
  const token = getAccessToken();
  if (isDemoModeEnabled() && (!token || token.startsWith("stub-"))) {
    void formData;
    return { hallId: `demo-hall-${Date.now()}` };
  }

  try {
    const { data, status } = await api.post<CreateHallResponseDto | "">(
      CREATE_HALL_PATH,
      formData,
      {
        timeout: 60000,
        // Drop JSON Content-Type so the runtime sets multipart boundary.
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
      return { hallId: null };
    }

    return { hallId: readHallId(data) };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "owner.management.addHall.errors.submitFailed",
      0,
    );
  }
}
