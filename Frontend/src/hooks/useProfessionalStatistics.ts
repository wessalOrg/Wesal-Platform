"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { isProfessionalRole } from "@/lib/account-role";
import { ApiError } from "@/lib/api-error";
import { fetchMyStatistics } from "@/services/statistics";
import type { OwnerStatistics } from "@/types/statistics";
import { useAuthenticatedRequestScope } from "@/hooks/useAuthenticatedRequestScope";

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
  const { scope, isCurrent } = useAuthenticatedRequestScope(
    authStatus === "ready" && session.isAuthenticated && isProfessionalRole(session.role), `${page}|${pageSize}`,
  );
  const [status, setStatus] = useState<ProfessionalStatisticsState["status"]>("loading");
  const [stats, setStats] = useState<OwnerStatistics | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const fetchStatistics = useCallback(() => {
    if (!isCurrent()) return Promise.resolve();
    const latest = scope.latest("statistics");
    const current = () => latest() && isCurrent();

    return fetchMyStatistics(page, pageSize).then((next) => {
      if (!current()) return;
      setStats(next);
      setStatus("ready");
    }).catch((err: unknown) => {
      if (!current()) return;
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
    });
  }, [isCurrent, scope, page, pageSize]);

  const initialStatus = authStatus === "loading" ? "loading" :
    !session.isAuthenticated || !isProfessionalRole(session.role) ? "forbidden" : "loading";
  const [seenRequest, setSeenRequest] = useState<null | typeof fetchStatistics>(null);
  if (seenRequest !== fetchStatistics) {
    setSeenRequest(() => fetchStatistics);
    setStatus(initialStatus);
    setStats(null);
    setErrorKey(null);
  }

  const reload = useCallback(async () => {
    if (!isCurrent()) return;
    setStatus(initialStatus);
    setErrorKey(null);
    if (initialStatus === "forbidden") setStats(null);
    await fetchStatistics();
  }, [fetchStatistics, initialStatus, isCurrent]);
  useEffect(() => {
    void fetchStatistics();
  }, [fetchStatistics]);

  return { status, stats, errorKey, reload };
}
