export type HourlySlotStatus = "available" | "booked";

export type HourlyDayStatus = "available" | "partial" | "booked" | "blocked" | "past";

export type HourlySlot = {
  start: string;
  end: string;
  label: string;
  status: HourlySlotStatus;
};

export type HourlyDay = {
  dateIso: string;
  blocked: boolean;
  slots: HourlySlot[];
};

export type HourlyMonthSnapshot = {
  hallId: string;
  showBookedSlots: boolean;
  days: HourlyDay[];
};

export type HourlyBookingInput = {
  hallId: string;
  date: string;
  slotTime: string;
  slotTimes?: string[];
  customerName: string;
  /** Booker's phone number; shown to the hall owner next to the booking name. */
  phoneNumber?: string;
  requesterName?: string;
  contactPhone?: string;
};

export type HourlyBookingResult = HourlyBookingInput & {
  bookingId: string;
};

export type BlockDayInput = {
  hallId: string;
  date: string;
  blocked: boolean;
};
