"use client";

import { useMemo } from "react";
import { parseBookingRejectionMessage } from "@/lib/booking-rejection-message";
import type { ClassifiedThreadContent } from "@/lib/booking-rejection-message";

export function useBookingRejectionMessage(
  content: string,
  fallbackHallName = "",
): ClassifiedThreadContent {
  return useMemo(
    () => parseBookingRejectionMessage(content, fallbackHallName),
    [content, fallbackHallName],
  );
}
