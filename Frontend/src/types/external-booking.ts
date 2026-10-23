export type ExternalBookingInput = {
  customerName: string;
  phone: string;
  eventType: "wedding" | "engagement" | "graduation" | "birthday" | "other";
  date: string;
  slotStarts: string[];
  guests: number | null;
  notes: string;
  totalAmount: number | null;
  amountReceivedExternally: number | null;
};

export type ExternalBooking = ExternalBookingInput & {
  bookingId: string;
  hallId: string;
  source: "ExternalManual";
  status: "Confirmed" | "Cancelled";
  timeRange: string;
  revision: number;
  confirmedAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  canEdit: boolean;
  canCancel: boolean;
  canConfirmDeposit: false;
  canDelete: false;
};
