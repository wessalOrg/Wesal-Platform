"use client";

import { useCallback, useRef, useState } from "react";
import { BookingError, bookingMessageKey } from "@/lib/booking-errors";
import { submitBookingRequest } from "@/services/bookings";
import type {
  BookingFieldErrors,
  BookingRequestInput,
  BookingRequestResult,
} from "@/types/booking";

export function useBookingSubmission() {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<BookingRequestResult | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [fields, setFields] = useState<BookingFieldErrors>({});
  const inFlight = useRef(false);

  const reset = useCallback(() => {
    setSubmitting(false);
    setSuccess(null);
    setErrorKey(null);
    setFields({});
    inFlight.current = false;
  }, []);

  const clearFeedback = useCallback(() => {
    setErrorKey(null);
    setFields({});
    setSuccess(null);
  }, []);

  const setValidation = useCallback((messageKey: string, nextFields?: BookingFieldErrors) => {
    setSuccess(null);
    setErrorKey(messageKey);
    setFields(nextFields ?? {});
  }, []);

  const submit = useCallback(async (input: BookingRequestInput) => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setSubmitting(true);
    setErrorKey(null);
    setFields({});
    setSuccess(null);

    try {
      const result = await submitBookingRequest(input);
      setSuccess(result);
      return result;
    } catch (err) {
      const error = err instanceof BookingError ? err : new BookingError("errors.booking.generic");
      setErrorKey(error.message.startsWith("errors.") ? error.message : bookingMessageKey(error.kind));
      setFields(error.fields);
      throw error;
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }, []);

  return {
    submitting,
    success,
    errorKey,
    fields,
    submit,
    reset,
    clearFeedback,
    setValidation,
  };
}
