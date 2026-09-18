"use client";

import OwnerBookingRequestItem from "@/components/owner-management/halls/OwnerBookingRequestItem";
import type { OwnerHallBookingRequest } from "@/types/owner-hall-booking-requests";

type OwnerBookingRequestListProps = {
  requests: OwnerHallBookingRequest[];
};

/**
 * Renders every server request independently — no date/period deduplication.
 */
export default function OwnerBookingRequestList({
  requests,
}: OwnerBookingRequestListProps) {
  return (
    <ul
      className="owner-booking-request-list owner-booking-request-list--animated min-w-0 space-y-3"
      data-testid="owner-booking-request-list"
    >
      {requests.map((request, index) => (
        <li
          key={request.id}
          className="min-w-0"
          style={{ ["--notify-i" as string]: index }}
        >
          <OwnerBookingRequestItem request={request} />
        </li>
      ))}
    </ul>
  );
}
