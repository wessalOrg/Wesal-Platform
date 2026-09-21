"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAdminPendingHalls } from "@/services/admin-halls";
import type { AdminPendingHall } from "@/types/admin-halls";

export function useAdminPendingHalls() {
  const [halls, setHalls] = useState<AdminPendingHall[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorKey(null);
    try {
      setHalls(await fetchAdminPendingHalls());
    } catch {
      setHalls([]);
      setErrorKey("admin.halls.queue.errors.loadFailed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const applyLockState = useCallback((hallId: string, adminLocked: boolean, systemLocked: boolean) => {
    setHalls((current) =>
      current.map((hall) =>
        hall.hallId === hallId
          ? { ...hall, adminLocked, systemLocked, lockBadgeVisible: true }
          : hall,
      ),
    );
  }, []);

  return { halls, loading, errorKey, reload: load, applyLockState };
}
