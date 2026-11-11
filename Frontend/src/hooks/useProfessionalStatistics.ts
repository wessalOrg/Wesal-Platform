"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { isProfessionalRole } from "@/lib/account-role";
import { ApiError } from "@/lib/api-error";
import { fetchMyStatistics } from "@/services/statistics";
import type { OwnerStatistics } from "@/types/statistics";

export type ProfessionalStatisticsState = {
  status: "loading" | "ready" | "error" | "forbidden";
  stats: OwnerStatistics | null;
  errorKey: string | null;
  reload: () => Promise<void>;
};

export function useProfessionalStatistics(
  page = 1,
  pageSize = 20,
): ProfessionalStatisticsState {
  const { session, status: authStatus } = useAuth();
  const [status, setStatus] = useState<ProfessionalStatisticsState["status"]>("loading");
  const [stats, setStats] = useState<OwnerStatistics | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (authStatus === "loading") {
      setStatus("loading");
      return;
    }
    if (!session.isAuthenticated || !isProfessionalRole(session.role)) {
      setStats(null);
      setErrorKey(null);
      setStatus("forbidden");
      return;
    }

    setStatus("loading");
    setErrorKey(null);
    try {
      const next = await fetchMyStatistics(page, pageSize);
      setStats(next);
      setStatus("ready");
    } catch (err) {
      setStats(null);
      if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
        setStatus("forbidden");
        setErrorKey(err.message || "statistics.errors.forbidden");
        return;
      }
      setStatus("error");
      setErrorKey(
        err instanceof ApiError ? err.message : "statistics.errors.loadFailed",
      );
    }
  }, [authStatus, page, pageSize, session.isAuthenticated, session.role]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { status, stats, errorKey, reload };
}
