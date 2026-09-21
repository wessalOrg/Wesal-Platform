"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { notifyPublicHallsChanged } from "@/lib/public-halls-events";
import { deleteAdminHall } from "@/services/admin-halls";

type UseDeleteAdminHallOptions = {
  onDeleted?: () => void;
};

export function useDeleteAdminHall(options?: UseDeleteAdminHallOptions) {
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const onDeletedRef = useRef(options?.onDeleted);
  useEffect(() => {
    onDeletedRef.current = options?.onDeleted;
  });

  const clearError = useCallback(() => {
    setErrorKey(null);
  }, []);

  const del = useCallback(async (hallId: string) => {
    const id = hallId.trim();
    if (!id || inFlightRef.current) return;

    inFlightRef.current = true;
    setPending(true);
    setErrorKey(null);

    try {
      await deleteAdminHall(id);
      notifyPublicHallsChanged();
      onDeletedRef.current?.();
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 401) setErrorKey("admin.delete.errors.unauthorized");
      else if (status === 403) setErrorKey("admin.delete.errors.forbidden");
      else if (status === 404) setErrorKey("admin.delete.errors.notFound");
      else setErrorKey("admin.delete.errors.generic");
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  }, []);

  return { deleteHall: del, pending, errorKey, clearError };
}
