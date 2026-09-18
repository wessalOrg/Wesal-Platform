import { readOptionalBool } from "@/lib/owner-publish-booking";
import type { HallBookingNotification } from "@/types/hall-notifications";

export function parseCanDeleteFlag(data: {
  canDelete?: unknown;
  isDeletable?: unknown;
  eligibleForDeletion?: unknown;
  canBeDeleted?: unknown;
  allowDelete?: unknown;
}): boolean {
  const explicit = readOptionalBool(
    data.canDelete ??
      data.isDeletable ??
      data.eligibleForDeletion ??
      data.canBeDeleted ??
      data.allowDelete,
  );
  return explicit === true;
}

/** Eligibility comes from Muhammad's flags — never inferred from local status math. */
export function canDeleteBooking(
  item: Pick<HallBookingNotification, "canDelete">,
): boolean {
  return item.canDelete === true;
}
