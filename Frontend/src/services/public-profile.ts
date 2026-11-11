import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { resolveOfferMediaUrl } from "@/lib/offer-format";
import { mapPost } from "@/services/posts";
import { mapProfessionalOffer } from "@/services/professional-offers";
import type { PublicProfessionalProfile } from "@/types/posts";

type ApiPublicProfile = {
  userId?: string;
  UserId?: string;
  role?: string | null;
  Role?: string | null;
  displayName?: string | null;
  DisplayName?: string | null;
  bio?: string | null;
  Bio?: string | null;
  profilePictureUrl?: string | null;
  ProfilePictureUrl?: string | null;
  shopName?: string | null;
  ShopName?: string | null;
  studioName?: string | null;
  StudioName?: string | null;
  shopLocation?: string | null;
  ShopLocation?: string | null;
  studioLocation?: string | null;
  StudioLocation?: string | null;
  isPubliclyAvailable?: boolean;
  IsPubliclyAvailable?: boolean;
  posts?: unknown[] | null;
  Posts?: unknown[] | null;
  offers?: unknown[] | null;
  Offers?: unknown[] | null;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** GET /profile/{userId} — public professional profile after approval. */
export async function fetchPublicProfessionalProfile(
  userId: string,
): Promise<PublicProfessionalProfile> {
  try {
    const { data } = await api.get<ApiPublicProfile>(
      `/profile/${encodeURIComponent(userId)}`,
      { timeout: 15000 },
    );
    const id = asText(data?.userId ?? data?.UserId) || userId;
    const postsRaw = data?.posts ?? data?.Posts ?? [];
    const offersRaw = data?.offers ?? data?.Offers ?? [];
    return {
      userId: id,
      role: asText(data?.role ?? data?.Role) || null,
      displayName: asText(data?.displayName ?? data?.DisplayName) || null,
      bio: asText(data?.bio ?? data?.Bio) || null,
      profilePictureUrl:
        resolveOfferMediaUrl(
          asText(data?.profilePictureUrl ?? data?.ProfilePictureUrl),
        ) || null,
      shopName: asText(data?.shopName ?? data?.ShopName) || null,
      studioName: asText(data?.studioName ?? data?.StudioName) || null,
      shopLocation: asText(data?.shopLocation ?? data?.ShopLocation) || null,
      studioLocation:
        asText(data?.studioLocation ?? data?.StudioLocation) || null,
      isPubliclyAvailable: Boolean(
        data?.isPubliclyAvailable ?? data?.IsPubliclyAvailable ?? true,
      ),
      posts: Array.isArray(postsRaw)
        ? postsRaw
            .map((row) => mapPost(row as Parameters<typeof mapPost>[0]))
            .filter((row): row is NonNullable<typeof row> => Boolean(row))
        : [],
      offers: Array.isArray(offersRaw)
        ? offersRaw
            .map((row) =>
              mapProfessionalOffer(
                row as Parameters<typeof mapProfessionalOffer>[0],
              ),
            )
            .filter((row): row is NonNullable<typeof row> => Boolean(row))
        : [],
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "posts.profile.errors.loadFailed",
      0,
    );
  }
}
