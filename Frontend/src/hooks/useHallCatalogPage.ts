"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  readAuthenticatedAccount, serverAuthenticatedAccount, subscribeAuthenticatedAccount,
} from "@/lib/authenticated-account";
import { hasActiveHallFilters, serializeHallFilters, type HallLocationFilters } from "@/hooks/useHallFilters";
import { fetchCatalogHalls, fetchSearchHalls, type HallCatalogLoadResult } from "@/services/halls";

/** A public query still belongs to its initiating login (including the guest context). */
export function useHallCatalogPage(filters: HallLocationFilters, pageNumber: number, pageSize: number, refresh: number) {
  const account = useSyncExternalStore(subscribeAuthenticatedAccount, readAuthenticatedAccount, serverAuthenticatedAccount);
  const filterKey = serializeHallFilters(filters);
  const region = filters.region;
  const address = filters.address.trim();
  const detailedAddress = filters.detailedAddress.trim();
  const request = useMemo(() => ({ account, filterKey, pageNumber, pageSize, refresh }),
    [account, filterKey, pageNumber, pageSize, refresh]);
  const [state, setState] = useState<{ request: typeof request; result: HallCatalogLoadResult } | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const current = () => active && readAuthenticatedAccount() === request.account;
    const query = { region, address, detailedAddress, pageNumber, pageSize };
    const pending = hasActiveHallFilters(query)
      ? fetchSearchHalls(query, controller.signal)
      : fetchCatalogHalls({ pageNumber, pageSize, signal: controller.signal });
    const finish = (result: HallCatalogLoadResult) => {
      if (!current()) return;
      setState(previous => {
        // A refresh failure keeps this page's usable data; another page never inherits its cards.
        if (result.source === "fallback" && !result.pagination && previous?.request.account === account && previous.request.filterKey === filterKey) {
          return { request, result: { ...result, pagination: previous.result.pagination,
            halls: previous.request.pageNumber === pageNumber ? previous.result.halls : [] } };
        }
        return { request, result };
      });
    };
    void pending.then(finish).catch(() => {
      if (current()) finish({ halls: [], source: "fallback", pagination: null });
    });
    return () => { active = false; controller.abort(); };
  }, [account, address, detailedAddress, filterKey, pageNumber, pageSize, region, request]);

  const sameQuery = state !== null && state.request.account === account && state.request.filterKey === filterKey;
  const samePage = sameQuery && state.request.pageNumber === pageNumber;
  const pending = state?.request !== request;
  const pagination = sameQuery ? state.result.pagination : null;
  const hasPage = samePage && pagination !== null;
  const halls = samePage ? state.result.halls : [];
  const error = !pending && state?.result.source === "fallback";
  return {
    halls, pagination, error,
    loading: pending && !hasPage,
    refreshing: pending && hasPage,
    ready: !pending || hasPage,
  };
}
