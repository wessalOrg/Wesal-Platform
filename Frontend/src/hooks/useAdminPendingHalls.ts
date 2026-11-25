"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { useAuthenticatedRequestScope } from "@/hooks/useAuthenticatedRequestScope";
import { HALL_APPROVED_EVENT, HALL_CREATED_EVENT, HALL_REJECTED_EVENT } from "@/lib/hall-review-events";
import { fetchAdminPendingHalls } from "@/services/admin-halls";
import type { AdminHallPage } from "@/lib/admin-halls-mapper";

export function useAdminPendingHalls(page = 1, correctPage?: (page: number) => void) {
  const { ready, authenticated, isAdmin } = useAccountAccess();
  const allowed = ready && authenticated && isAdmin;
  const [refresh, setRefresh] = useState(0);
  const { account, scope, isCurrent } = useAuthenticatedRequestScope(allowed, page + ":" + refresh);
  const [state, setState] = useState<{
    scope: typeof scope; account: typeof account; page: number; result: AdminHallPage | null; errorKey: string | null;
  } | null>(null);
  const reload = useCallback(() => setRefresh(value => value + 1), []);

  useEffect(() => {
    if (!allowed || !account || !isCurrent()) return;
    const controller = new AbortController();
    const current = scope.latest("pending-halls");
    void fetchAdminPendingHalls(page, controller.signal).then(result => {
      if (!current() || !isCurrent()) return;
      const lastPage = Math.max(1, result.totalPages);
      if (page > lastPage && correctPage) { correctPage(lastPage); return; }
      setState({ scope, account, page, result, errorKey: null });
    }).catch(() => {
      if (!current() || !isCurrent()) return;
      setState(previous => ({ scope, account, page,
        result: previous?.account === account && previous.page === page ? previous.result : null,
        errorKey: "admin.halls.queue.errors.loadFailed" }));
    });
    return () => controller.abort();
  }, [account, allowed, correctPage, isCurrent, page, scope]);

  useEffect(() => {
    if (!allowed || !account) return;
    const events = [HALL_APPROVED_EVENT, HALL_REJECTED_EVENT, HALL_CREATED_EVENT];
    for (const event of events) window.addEventListener(event, reload);
    return () => { for (const event of events) window.removeEventListener(event, reload); };
  }, [account, allowed, reload]);

  const belongs = allowed && account !== null && state?.account === account;
  const result = belongs ? state.result : null;
  const halls = belongs && state.page === page ? result?.items ?? [] : [];
  const loading = Boolean(allowed && account && state?.scope !== scope);
  const applyLockState = useCallback((hallId: string, adminLocked: boolean, systemLocked: boolean) => {
    if (!isCurrent()) return;
    setState(previous => previous?.scope === scope && previous.result ? { ...previous,
      result: { ...previous.result, items: previous.result.items.map(hall => hall.hallId === hallId
        ? { ...hall, adminLocked, systemLocked, lockBadgeVisible: adminLocked || systemLocked } : hall) } } : previous);
  }, [isCurrent, scope]);
  return { halls, page, totalCount: result?.totalCount ?? null, totalPages: result?.totalPages ?? 0,
    loading, errorKey: allowed && state?.scope === scope ? state.errorKey : null, reload, applyLockState };
}
