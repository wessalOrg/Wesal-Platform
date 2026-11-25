"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { useAuthenticatedRequestScope } from "@/hooks/useAuthenticatedRequestScope";
import { HELP_CENTER_CHANGE_EVENT } from "@/types/help-center";
import {
  fetchAdminHelpTicketPage, markHelpConversationReadOnServer, replyHelpTicket,
  type AdminHelpTicketPage,
} from "@/services/help-tickets";

function createHelpRequests(scope: { isActive: () => boolean }) {
  const controllers = new Set<AbortController>();
  const writes = new Set<string>();
  return {
    track(controller: AbortController) { controllers.add(controller); },
    release(controller: AbortController) { controllers.delete(controller); },
    reserve(key: string) {
      if (!scope.isActive() || writes.has(key)) return false;
      writes.add(key); return true;
    },
    finish(key: string) { writes.delete(key); },
    abort() { for (const controller of controllers) controller.abort(); controllers.clear(); },
  };
}

/** Admin pages are held in memory by continuous login, never in the unowned legacy help cache. */
export function useAdminHelpTickets(page = 1, correctPage?: (page: number) => void) {
  const access = useAccountAccess();
  const allowed = access.ready && access.authenticated && access.isAdmin;
  const { account, scope, isCurrent } = useAuthenticatedRequestScope(allowed);
  const requests = useMemo(() => createHelpRequests(scope), [scope]);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<{
    scope: typeof scope; page: number; refresh: number; result: AdminHelpTicketPage | null; error: boolean;
  } | null>(null);
  const reload = useCallback(() => {
    if (!isCurrent()) return;
    scope.latest("help-list");
    setRefresh(value => value + 1);
  }, [isCurrent, scope]);

  useEffect(() => () => requests.abort(), [requests]);
  useEffect(() => {
    if (!allowed || !account || !isCurrent()) return;
    const controller = new AbortController();
    const current = scope.latest("help-list");
    requests.track(controller);
    void fetchAdminHelpTicketPage(page, controller.signal).then(result => {
      if (!current() || !isCurrent()) return;
      const lastPage = Math.max(1, result.totalPages);
      if (page > lastPage && correctPage) { correctPage(lastPage); return; }
      setState({ scope, page, refresh, result, error: false });
    }).catch(() => {
      if (controller.signal.aborted || !current() || !isCurrent()) return;
      setState(previous => ({ scope, page, refresh, error: true,
        result: previous?.scope === scope && previous.page === page ? previous.result : null }));
    }).finally(() => requests.release(controller));
    return () => controller.abort();
  }, [account, allowed, correctPage, isCurrent, page, refresh, requests, scope]);

  useEffect(() => {
    if (!allowed || !account) return;
    const visible = () => { if (document.visibilityState === "visible") reload(); };
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") reload(); }, 60_000);
    window.addEventListener(HELP_CENTER_CHANGE_EVENT, reload);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(HELP_CENTER_CHANGE_EVENT, reload);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [account, allowed, reload]);

  const mutate = useCallback(async <T,>(key: string, operation: (signal: AbortSignal) => Promise<T>) => {
    if (!isCurrent() || !requests.reserve(key)) return null;
    const current = scope.capture();
    const controller = new AbortController();
    requests.track(controller);
    try {
      const result = await operation(controller.signal);
      if (!current() || !isCurrent()) return null;
      // Invalidate pending page snapshots before reloading the server's shared read/reply state.
      scope.latest("help-list");
      window.dispatchEvent(new Event(HELP_CENTER_CHANGE_EVENT));
      return result;
    } finally { requests.finish(key); requests.release(controller); }
  }, [isCurrent, requests, scope]);
  const reply = useCallback(async (id: string, content: string) =>
    mutate("reply:" + id, signal => replyHelpTicket(id, content, signal)), [mutate]);
  const markConversationRead = useCallback(async (userId: string) =>
    mutate("read:" + userId, signal => markHelpConversationReadOnServer(userId, signal)), [mutate]);
  const current = allowed && state?.scope === scope && state.page === page;
  return { account, scope, isCurrent, result: current ? state.result : null,
    ready: access.ready, loading: allowed && (!current || state.refresh !== refresh),
    error: current && state.error, reload, reply, markConversationRead };
}
