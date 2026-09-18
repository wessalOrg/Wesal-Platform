"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAdminSubscriptionOverview } from "@/services/admin-halls";
import type { AdminMarkPaidResult, AdminSubscriptionOwnerGroup } from "@/types/admin-halls";

export function useAdminSubscriptionOverview() {
  const [groups, setGroups] = useState<AdminSubscriptionOwnerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorKey(null);
    try {
      setGroups(await fetchAdminSubscriptionOverview());
    } catch {
      setGroups([]);
      setErrorKey("admin.halls.paid.overview.errors.loadFailed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyPaidState = useCallback((result: AdminMarkPaidResult) => {
    setGroups((current) =>
      current.map((group) => ({
        ...group,
        halls: group.halls.map((hall) =>
          hall.hallId === result.hallId
            ? {
                ...hall,
                paymentStatus: result.paymentStatus,
                systemLocked: result.systemLocked,
                adminLocked: result.adminLocked,
                nextBillingDate: result.cycleEnd,
                lastPaymentDate: result.cycleStart,
                daysRemaining: result.daysRemaining,
              }
            : hall,
        ),
      })),
    );
  }, []);

  const applyLockState = useCallback((hallId: string, adminLocked: boolean, systemLocked: boolean) => {
    setGroups((current) =>
      current.map((group) => ({
        ...group,
        halls: group.halls.map((hall) =>
          hall.hallId === hallId ? { ...hall, adminLocked, systemLocked } : hall,
        ),
      })),
    );
  }, []);

  return { groups, loading, errorKey, reload: load, applyPaidState, applyLockState };
}
