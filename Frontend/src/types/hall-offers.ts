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

export type HallOfferPage = {
  items: HallOffer[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type CreateHallOfferInput = {
  oldBookingPrice: number;
  offerPrice: number;
  startsAt: string;
  endsAt: string;
};
