"use client";

import { useCallback, useRef, useState } from "react";
import { emitBookingDeleted } from "@/lib/booking-events";
import { notifyPublicHallsChanged } from "@/lib/public-halls-events";
import { DeleteBookingError } from "@/lib/delete-booking-errors";
import { deleteHallBooking } from "@/services/hall-notifications";
import type { DeleteBookingResult } from "@/types/hall-notifications";

type UseDeleteBookingOptions = {
  onDeleted?: (result: DeleteBookingResult) => void;
};

export function useDeleteBooking(options?: UseDeleteBookingOptions) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const inFlightRef = useRef<string | null>(null);
  const onDeletedRef = useRef(options?.onDeleted);
  onDeletedRef.current = options?.onDeleted;

  const clearError = useCallback((bookingId: string) => {
    setErrorById((current) => {
      if (!current[bookingId]) return current;
      const next = { ...current };
      delete next[bookingId];
      return next;
    });
  }, []);

  const remove = useCallback(
    async (hallId: string, bookingId: string, context?: { date?: string; periods?: DeleteBookingResult["periods"] }) => {
      const id = bookingId.trim();
      const hall = hallId.trim();
      if (!id || !hall || inFlightRef.current) return null;

      inFlightRef.current = id;
      setDeletingId(id);
      clearError(id);

      try {
        const result = await deleteHallBooking(hall, id);
        const resolved: DeleteBookingResult = {
          ...result,
          date: result.date || context?.date || "",
          periods: result.periods.length > 0 ? result.periods : context?.periods ?? [],
        };
        onDeletedRef.current?.(resolved);
        emitBookingDeleted({
          bookingId: resolved.bookingId,
          hallId: resolved.hallId,
          date: resolved.date,
          periods: resolved.periods,
        });
        notifyPublicHallsChanged();
        return resolved;
      } catch (err) {
        const mapped =
          err instanceof DeleteBookingError
            ? err
            : new DeleteBookingError("errors.owner.delete.generic");

        if (mapped.kind === "not_found") {
          const resolved: DeleteBookingResult = {
            bookingId: id,
            hallId: hall,
            date: context?.date || "",
            periods: context?.periods ?? [],
            alreadyDeleted: true,
          };
          onDeletedRef.current?.(resolved);
          emitBookingDeleted({
            bookingId: resolved.bookingId,
            hallId: resolved.hallId,
            date: resolved.date,
            periods: resolved.periods,
          });
          notifyPublicHallsChanged();
          return resolved;
        }

        setErrorById((current) => ({
          ...current,
          [id]: mapped.backendMessage || mapped.message,
        }));
        return null;
      } finally {
        inFlightRef.current = null;
        setDeletingId(null);
      }
    },
    [clearError],
  );

  return {
    remove,
    deletingId,
    errorById,
    clearError,
  };
}
