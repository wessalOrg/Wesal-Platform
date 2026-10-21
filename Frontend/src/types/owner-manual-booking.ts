export type OwnerManualEventType =
  | "wedding"
  | "engagement"
  | "graduation"
  | "birthday"
  | "other";

export type OwnerManualBooking = {
  id: string;
  hallId: string;
  hallName: string;
  eventType: OwnerManualEventType;
  customerName: string;
  phone: string;
  date: string;
  timeFrom: string;
  timeTo: string;
  guests: number | null;
  totalAmount: number | null;
  depositAmount: number | null;
  notes: string;
  createdAt: string;
};
