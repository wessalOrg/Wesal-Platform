/** Max length accepted by the hourly-booking API for `nameOnBooking`. */
export const NAME_ON_BOOKING_MAX = 100;

export type ParsedNameOnBooking = {
  displayName: string;
  eventTypeLabel?: string;
  phone?: string;
};

/**
 * The hourly-booking API has no dedicated phone/event fields; the owner sees
 * `nameOnBooking`, so the seeker confirm dialog packs "Name · Event - Phone".
 */
export function nameOnBookingLabel(
  name: string,
  eventTypeLabel?: string,
  phone?: string,
): string {
  const event = eventTypeLabel?.trim();
  const base = event ? `${name} · ${event}` : name;
  const number = phone?.trim();
  if (!number) return base.slice(0, NAME_ON_BOOKING_MAX);
  const suffix = ` - ${number}`;
  const room = Math.max(NAME_ON_BOOKING_MAX - suffix.length, 0);
  return `${base.slice(0, room).trim()}${suffix}`;
}

/** Unpack the seeker confirm payload for owner-facing cards. */
export function parseNameOnBooking(raw: string | null | undefined): ParsedNameOnBooking {
  let value = (raw ?? "").trim();
  if (!value) return { displayName: "" };

  let phone: string | undefined;
  const phoneSep = value.lastIndexOf(" - ");
  if (phoneSep >= 0) {
    const candidate = value.slice(phoneSep + 3).trim();
    if (candidate.length >= 7 && /\d/.test(candidate)) {
      phone = candidate;
      value = value.slice(0, phoneSep).trim();
    }
  }

  const eventSep = value.indexOf(" · ");
  if (eventSep >= 0) {
    const displayName = value.slice(0, eventSep).trim();
    const eventTypeLabel = value.slice(eventSep + 3).trim();
    return {
      displayName,
      eventTypeLabel: eventTypeLabel || undefined,
      phone,
    };
  }

  return { displayName: value, phone };
}
