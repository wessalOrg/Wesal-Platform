import type { AccountApprovalStatus } from "@/types/account-approval";

/** Backend ApplicationRoles for public professionals. */
export type ProfessionalPublicRole = "EventCoordinator" | "Photographer";

export type ProfessionalProfileContentImage = {
  id: string;
  url: string;
  order: number;
};

/** Shared post/offer card from public profile and list endpoints. */
export type ProfessionalProfileContentItem = {
  id: string;
  ownerUserId: string | null;
  content: string | null;
  price: number | null;
  oldPrice: number | null;
  offerPrice: number | null;
  startsAt: string | null;
  endsAt: string | null;
  stoppedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  saveCount: number;
  shareCount: number;
  images: ProfessionalProfileContentImage[];
};

export type ProfessionalProfileContentPage = {
  items: ProfessionalProfileContentItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type PublicProfessionalProfile = {
  userId: string;
  role: ProfessionalPublicRole | null;
  approvalStatus: AccountApprovalStatus | null;
  isPubliclyAvailable: boolean;
  displayName: string;
  shopName: string | null;
  onlineStoreName: string | null;
  phoneNumber: string | null;
  shopLocation: string | null;
  studioName: string | null;
  studioLocation: string | null;
  detailedStudioLocation: string | null;
  bio: string | null;
  profilePictureUrl: string | null;
  posts: ProfessionalProfileContentItem[];
  offers: ProfessionalProfileContentItem[];
};

export type ProfessionalProfileTab = "posts" | "offers";
