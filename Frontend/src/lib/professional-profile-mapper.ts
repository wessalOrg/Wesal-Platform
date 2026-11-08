import { normalizeAccountApprovalStatus } from "@/lib/account-approval";
import type { AccountApprovalStatus } from "@/types/account-approval";
import type {
  ProfessionalProfileContentImage,
  ProfessionalProfileContentItem,
  ProfessionalProfileContentPage,
  ProfessionalPublicRole,
  PublicProfessionalProfile,
} from "@/types/professional-profile";

/** Backend PublicProfiles.DisplayNameFallback */
export const PROFESSIONAL_DISPLAY_NAME_FALLBACK = "مستخدم";

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asId(value: unknown): string | null {
  const text = asText(value);
  return text || null;
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    return text === "true" || text === "1";
  }
  return false;
}

function asInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return 0;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function mapRole(raw: unknown): ProfessionalPublicRole | null {
  const text = asText(raw);
  if (!text) return null;
  const token = text.replace(/[\s_-]/g, "").toLowerCase();
  if (token === "eventcoordinator" || token === "coordinator") return "EventCoordinator";
  if (token === "photographer") return "Photographer";
  return null;
}

function mapApproval(raw: unknown): AccountApprovalStatus | null {
  return normalizeAccountApprovalStatus(
    typeof raw === "number" || typeof raw === "string" ? raw : asText(raw),
  );
}

function mapImage(payload: unknown): ProfessionalProfileContentImage | null {
  if (!payload || typeof payload !== "object") return null;
  const dto = payload as Record<string, unknown>;
  const id = asId(dto.id ?? dto.Id);
  const url = asText(dto.url ?? dto.Url);
  if (!id || !url) return null;
  return { id, url, order: asInt(dto.order ?? dto.Order) };
}

export function mapProfessionalProfileContentItem(
  payload: unknown,
): ProfessionalProfileContentItem | null {
  if (!payload || typeof payload !== "object") return null;
  const dto = payload as Record<string, unknown>;
  const id = asId(dto.id ?? dto.Id);
  if (!id) return null;
  const rawImages = dto.images ?? dto.Images;
  const images = Array.isArray(rawImages)
    ? rawImages
        .map(mapImage)
        .filter((row): row is ProfessionalProfileContentImage => Boolean(row))
        .sort((a, b) => a.order - b.order)
    : [];

  return {
    id,
    ownerUserId: asId(dto.ownerUserId ?? dto.OwnerUserId),
    content: asText(dto.content ?? dto.Content) || null,
    price: asNumber(dto.price ?? dto.Price),
    oldPrice: asNumber(dto.oldPrice ?? dto.OldPrice),
    offerPrice: asNumber(dto.offerPrice ?? dto.OfferPrice),
    startsAt: asText(dto.startsAt ?? dto.StartsAt) || null,
    endsAt: asText(dto.endsAt ?? dto.EndsAt) || null,
    stoppedAt: asText(dto.stoppedAt ?? dto.StoppedAt) || null,
    createdAt: asText(dto.createdAt ?? dto.CreatedAt) || null,
    updatedAt: asText(dto.updatedAt ?? dto.UpdatedAt) || null,
    saveCount: Math.max(0, asInt(dto.saveCount ?? dto.SaveCount)),
    shareCount: Math.max(0, asInt(dto.shareCount ?? dto.ShareCount)),
    images,
  };
}

export function mapProfessionalProfileContentPage(
  payload: unknown,
): ProfessionalProfileContentPage {
  if (!payload || typeof payload !== "object") {
    return { items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 };
  }
  const dto = payload as Record<string, unknown>;
  const rawItems = dto.items ?? dto.Items;
  const items = Array.isArray(rawItems)
    ? rawItems
        .map(mapProfessionalProfileContentItem)
        .filter((row): row is ProfessionalProfileContentItem => Boolean(row))
    : [];
  const page = Math.max(1, asInt(dto.pageNumber ?? dto.PageNumber ?? dto.page ?? 1));
  const pageSize = Math.max(1, asInt(dto.pageSize ?? dto.PageSize ?? 10));
  const totalCount = Math.max(0, asInt(dto.totalCount ?? dto.TotalCount ?? items.length));
  const totalPages = Math.max(
    0,
    asInt(dto.totalPages ?? dto.TotalPages) ||
      (pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0),
  );
  return { items, page, pageSize, totalCount, totalPages };
}

export function mapPublicProfessionalProfile(
  payload: unknown,
): PublicProfessionalProfile | null {
  if (!payload || typeof payload !== "object") return null;
  const dto = payload as Record<string, unknown>;
  const userId = asId(dto.userId ?? dto.UserId);
  if (!userId) return null;

  const role = mapRole(dto.role ?? dto.Role);
  const isPubliclyAvailable = asBool(dto.isPubliclyAvailable ?? dto.IsPubliclyAvailable);
  const rawPosts = dto.posts ?? dto.Posts;
  const rawOffers = dto.offers ?? dto.Offers;

  const displayName =
    asText(dto.displayName ?? dto.DisplayName) || PROFESSIONAL_DISPLAY_NAME_FALLBACK;

  return {
    userId,
    role,
    approvalStatus: mapApproval(dto.approvalStatus ?? dto.ApprovalStatus),
    isPubliclyAvailable,
    displayName,
    shopName: asText(dto.shopName ?? dto.ShopName) || null,
    onlineStoreName: asText(dto.onlineStoreName ?? dto.OnlineStoreName) || null,
    phoneNumber: asText(dto.phoneNumber ?? dto.PhoneNumber) || null,
    shopLocation: asText(dto.shopLocation ?? dto.ShopLocation) || null,
    studioName: asText(dto.studioName ?? dto.StudioName) || null,
    studioLocation: asText(dto.studioLocation ?? dto.StudioLocation) || null,
    detailedStudioLocation:
      asText(dto.detailedStudioLocation ?? dto.DetailedStudioLocation) || null,
    bio: asText(dto.bio ?? dto.Bio) || null,
    profilePictureUrl: asText(dto.profilePictureUrl ?? dto.ProfilePictureUrl) || null,
    posts: Array.isArray(rawPosts)
      ? rawPosts
          .map(mapProfessionalProfileContentItem)
          .filter((row): row is ProfessionalProfileContentItem => Boolean(row))
      : [],
    offers: Array.isArray(rawOffers)
      ? rawOffers
          .map(mapProfessionalProfileContentItem)
          .filter((row): row is ProfessionalProfileContentItem => Boolean(row))
      : [],
  };
}

export function professionalPublicLocation(
  profile: PublicProfessionalProfile,
): string | null {
  if (profile.role === "EventCoordinator") {
    return profile.shopLocation;
  }
  if (profile.role === "Photographer") {
    const parts = [profile.studioLocation, profile.detailedStudioLocation].filter(Boolean);
    return parts.length ? parts.join(" · ") : null;
  }
  return profile.shopLocation || profile.studioLocation || null;
}

export function isPhotographerProfessional(
  role: ProfessionalPublicRole | null | undefined,
): boolean {
  return role === "Photographer";
}

export function isCoordinatorProfessional(
  role: ProfessionalPublicRole | null | undefined,
): boolean {
  return role === "EventCoordinator";
}
