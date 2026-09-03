import { ApiError } from "@/lib/api-error";
import type { BookingErrorKind, BookingFieldErrors } from "@/types/booking";

export class BookingError extends ApiError {
  kind: BookingErrorKind;
  fields: BookingFieldErrors;

  constructor(
    message: string,
    status?: number,
    extras?: { kind?: BookingErrorKind; fields?: BookingFieldErrors; details?: unknown },
  ) {
    super(message, status, extras?.details);
    this.name = "BookingError";
    this.kind = extras?.kind ?? kindFromStatus(status);
    this.fields = extras?.fields ?? {};
  }
}

export function kindFromStatus(status?: number): BookingErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 400) return "validation";
  return "generic";
}

export function bookingMessageKey(kind: BookingErrorKind): string {
  if (kind === "unauthorized") return "errors.booking.unauthorized";
  if (kind === "forbidden") return "errors.booking.forbidden";
  if (kind === "not_found") return "errors.booking.notFound";
  if (kind === "conflict") return "errors.booking.conflict";
  if (kind === "validation") return "errors.booking.validation";
  return "errors.booking.generic";
}

function firstErrorMessage(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
    return value[0].trim();
  }
  return undefined;
}

export function fieldErrorsFromUnknown(data: unknown): BookingFieldErrors {
  if (!data || typeof data !== "object") return {};
  const raw = (data as { errors?: Record<string, unknown> }).errors;
  if (!raw || typeof raw !== "object") return {};

  const fields: BookingFieldErrors = {};
  for (const [key, value] of Object.entries(raw)) {
    const message = firstErrorMessage(value);
    if (!message) continue;
    const normalized = key.toLowerCase();
    if (normalized === "date") fields.date = localizeBookingFieldMessage(message);
    if (normalized === "periods") fields.periods = localizeBookingFieldMessage(message);
  }
  return fields;
}

function localizeBookingFieldMessage(message: string): string {
  if (/future/i.test(message) || /يجب أن يكون تاريخ الحجز في المستقبل/.test(message)) {
    return "errors.booking.dateFuture";
  }
  if (/at least one/i.test(message) || /فترة واحدة/.test(message)) {
    return "errors.booking.periodRequired";
  }
  if (/duplicate/i.test(message)) return "errors.booking.periodRequired";
  if (/not available at this hall/i.test(message) || /غير متاحة في هذه القاعة/.test(message)) {
    return "errors.booking.periodUnavailable";
  }
  return message;
}

export function toBookingError(err: unknown, fallback = "errors.booking.generic"): BookingError {
  if (err instanceof BookingError) return err;
  if (err instanceof ApiError) {
    const fields = fieldErrorsFromUnknown(err.details);
    const kind = kindFromStatus(err.status);
    const message =
      kind === "conflict"
        ? "errors.booking.conflict"
        : Object.keys(fields).length > 0
          ? "errors.booking.validation"
          : bookingMessageKey(kind);
    return new BookingError(message || fallback, err.status, {
      kind,
      fields,
      details: err.details,
    });
  }
  return new BookingError(fallback);
}
