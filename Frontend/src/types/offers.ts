/** Offer lifecycle derived from startsAt / endsAt / stoppedAt (client-side). */
export type OfferLifecycleStatus =
  | "active"
  | "scheduled"
  | "expired"
  | "stopped";

export type OfferImage = {
  id: string;
  url: string;
  order: number;
};

/** Shared shape for professional offers (PublicProfileContentDto / mine / profile). */
export type ProfessionalOffer = {
  id: string;
  ownerUserId: string | null;
  content: string | null;
  oldPrice: number;
  offerPrice: number;
  /** Optional price-box field from API (`price` / PriceBox). */
  priceBox: number | null;
  startsAt: string;
  endsAt: string;
  stoppedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  images: OfferImage[];
  saveCount: number;
  shareCount: number;
};

export type HallOffer = {
  id: string;
  hallId: string;
  hallName: string;
  mainImageUrl: string | null;
  oldBookingPrice: number;
  offerPrice: number;
  startsAt: string;
  endsAt: string;
  stoppedAt: string | null;
};

export type CreateProfessionalOfferInput = {
  content?: string | null;
  oldPrice: number;
  offerPrice: number;
  priceBox?: number | null;
  startsAt: string;
  endsAt: string;
  images?: File[];
};

export type UpdateProfessionalOfferInput = CreateProfessionalOfferInput & {
  replaceImages: boolean;
  keepImageIds: string[];
};

export type CreateHallOfferInput = {
  oldBookingPrice: number;
  offerPrice: number;
  startsAt: string;
  endsAt: string;
};

export type UpdateHallOfferInput = CreateHallOfferInput;

export type DiscoverContentType =
  | "Hall"
  | "Post"
  | "EventCoordinator"
  | "Photographer"
  | "ProfessionalOffer"
  | "HallOffer"
  | string;

export type DiscoverFilter =
  | "All"
  | "Halls"
  | "EventCoordinators"
  | "Coordinators"
  | "Photographers"
  | "Offers";

export type DiscoverItem = {
  contentType: DiscoverContentType;
  id: string;
  /** Hall id for Hall / HallOffer cards (from DiscoverItemDto.HallId). */
  hallId: string | null;
  ownerUserId: string | null;
  displayName: string | null;
  content: string | null;
  imageUrl: string | null;
  location: string | null;
  price: number | null;
  oldPrice: number | null;
  offerPrice: number | null;
  startsAt: string | null;
  endsAt: string | null;
  /** Present when mapped from richer offer DTOs; Discover feed usually omits it. */
  stoppedAt?: string | null;
  createdAt: string;
};

export type PagedOffers<T> = {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};
