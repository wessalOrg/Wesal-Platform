"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAdminHallDetail } from "@/services/admin-halls";
import type { AdminHallDetail, AdminHallStatus } from "@/types/admin-halls";

export type AdminHallDetailLoadStatus = "idle" | "loading" | "ready" | "error";

export function useAdminHallDetail(hallId: string | null) {
  const [status, setStatus] = useState<AdminHallDetailLoadStatus>(
    hallId ? "loading" : "idle",
  );
  const [hall, setHall] = useState<AdminHallDetail | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = hallId?.trim() ?? "";
    if (!id) {
      setStatus("idle");
      setHall(null);
      return;
    }

    setStatus("loading");
    setErrorKey(null);
    try {
      const next = await fetchAdminHallDetail(id);
      setHall(next);
      setStatus("ready");
    } catch {
      setHall(null);
      setErrorKey("admin.halls.detail.errors.loadFailed");
      setStatus("error");
    }
  }, [hallId]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyStatus = useCallback((nextStatus: AdminHallStatus) => {
    setHall((current) => {
      if (!current) return current;
      return {
        ...current,
        status: nextStatus,
        approvalBadge:
          nextStatus === "Approved"
            ? "Approved"
            : nextStatus === "Rejected"
              ? "Rejected"
              : "Pending",
      };
    });
  }, []);

  const applyLockState = useCallback((adminLocked: boolean, systemLocked: boolean) => {
    setHall((current) => {
      if (!current) return current;
      return {
        ...current,
        adminLocked,
        systemLocked,
        lockBadgeVisible: true,
      };
    });
  }, []);

  const applyPaidState = useCallback(
    (result: {
      paymentStatus: AdminHallDetail["paymentStatus"];
      systemLocked: boolean;
      adminLocked: boolean;
      cycleStart: string | null;
      cycleEnd: string | null;
      daysRemaining: number | null;
    }) => {
      setHall((current) => {
        if (!current) return current;
        return {
          ...current,
          paymentStatus: result.paymentStatus,
          systemLocked: result.systemLocked,
          adminLocked: result.adminLocked,
          cycleStart: result.cycleStart,
          cycleEnd: result.cycleEnd,
          daysRemaining: result.daysRemaining,
          lockBadgeVisible: true,
        };
      });
    },
    [],
  );

  return {
    status,
    hall,
    errorKey,
    reload: load,
    applyStatus,
    applyLockState,
    applyPaidState,
  };
}
