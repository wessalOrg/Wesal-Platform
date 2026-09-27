import { fetchOwnerHallBookingRequests } from "@/services/owner-hall-booking-requests";

/** Finds which owned hall contains the booking request, if any. */
export async function findHallIdForBookingRequest(
  hallIds: string[],
  requestId: string,
): Promise<string | null> {
  const id = requestId.trim();
  if (!id || hallIds.length === 0) return null;

  const matches = await Promise.all(
    hallIds.map(async (hallId) => {
      try {
        const items = await fetchOwnerHallBookingRequests(hallId);
        return items.some((item) => item.id === id) ? hallId : null;
      } catch {
        return null;
      }
    }),
  );

  return matches.find((hallId): hallId is string => Boolean(hallId)) ?? null;
}
