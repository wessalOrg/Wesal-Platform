"use client";

import { useCallback, useRef, useState } from "react";
import { toDeleteHallError } from "@/lib/delete-hall-errors";
import { emitHallDeleted } from "@/lib/hall-events";
import { notifyHallOwnerHallsChanged } from "@/lib/hall-owner-halls-events";
import { notifyPublicHallsChanged } from "@/lib/public-halls-events";
import { deleteOwnedHall } from "@/services/halls";
import type { DeleteHallResult } from "@/types/hall";

type UseDeleteHallOptions = {
  onDeleted?: (result: DeleteHallResult) => void;
};

export function useDeleteHall(options?: UseDeleteHallOptions) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const onDeletedRef = useRef(options?.onDeleted);
  onDeletedRef.current = options?.onDeleted;

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const remove = useCallback(async (hallId: string) => {
    const id = hallId.trim();
    if (!id || inFlightRef.current) return null;

    inFlightRef.current = true;
    setDeleting(true);
    setError(null);

    try {
      const result = await deleteOwnedHall(id);
      emitHallDeleted({ hallId: result.hallId });
      notifyHallOwnerHallsChanged();
      notifyPublicHallsChanged();
      onDeletedRef.current?.(result);
      return result;
    } catch (err) {
      const mapped = toDeleteHallError(err);

      if (mapped.kind === "not_found") {
        const result: DeleteHallResult = { hallId: id, alreadyDeleted: true };
        emitHallDeleted({ hallId: id });
        notifyHallOwnerHallsChanged();
        notifyPublicHallsChanged();
        onDeletedRef.current?.(result);
        return result;
      }

      setError(mapped.backendMessage || mapped.message);
      return null;
    } finally {
      inFlightRef.current = false;
      setDeleting(false);
    }
  }, []);

  return {
    remove,
    deleting,
    error,
    clearError,
  };
}
