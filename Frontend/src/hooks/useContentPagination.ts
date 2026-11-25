"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRequestScope } from "@/hooks/useRequestScope";
import { contentTotal, hasNextContentPage, mergeContent, type ContentPage } from "@/lib/content-pagination";

type Snapshot<T> = {
  context: string | object;
  items: T[];
  pages: number;
  total: number | null;
  hasMore: boolean;
  busy: boolean;
  error: unknown;
};

/** One request generation owns the complete list, including append and refresh requests. */
export function useContentPagination<T extends { id: string }>({
  context, enabled = true, pageSize, fetchPage, autoLoadAll = false,
}: {
  context: string | object;
  enabled?: boolean;
  pageSize: number;
  fetchPage: (page: number, size: number) => Promise<ContentPage<T>>;
  /** Status filters have no server-side aggregates: collect all pages before counting them. */
  autoLoadAll?: boolean;
}) {
  const scope = useRequestScope();
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null);
  const latest = useRef<Snapshot<T> | null>(null);
  const pending = useRef(false);
  const activeContext = useRef<string | object | null>(null);
  useLayoutEffect(() => {
    activeContext.current = enabled ? context : null;
    scope.latest("pages");
    pending.current = false;
    if (latest.current?.context !== context) latest.current = null;
    return () => { activeContext.current = null; scope.latest("pages"); };
  }, [context, enabled, scope]);

  const request = useCallback(async (append: boolean) => {
    if (!enabled || activeContext.current !== context || !scope.isActive() || (append && pending.current)) return;
    const previous = latest.current?.context === context ? latest.current : null;
    if (append && (!previous || !previous.hasMore)) return;
    const current = scope.latest("pages");
    pending.current = true;
    const commit = (next: Snapshot<T>) => {
      if (!current()) return;
      latest.current = next;
      setSnapshot(next);
    };
    const initial: Snapshot<T> = previous ?? {
      context, items: [], pages: 0, total: null, hasMore: false, busy: false, error: null,
    };
    commit({ ...initial, busy: true, error: null });
    let items = append ? initial.items : [];
    let number = append ? initial.pages + 1 : 1;
    const target = append ? number : Math.max(1, initial.pages);
    try {
      while (current()) {
        const page = await fetchPage(number, pageSize);
        if (!current()) return;
        items = mergeContent(items, page.items);
        const hasMore = hasNextContentPage(page, number, pageSize);
        const keepLoading = hasMore && (autoLoadAll || number < target);
        // Refresh replaces the loaded range atomically; initial collection can show progress.
        if (!initial.pages || !keepLoading) {
          commit({ context, items, pages: number, total: contentTotal(page), hasMore,
            busy: keepLoading, error: null });
        }
        if (!keepLoading) break;
        number += 1;
      }
    } catch (error) {
      if (current()) commit({ ...(latest.current ?? initial), busy: false, error });
    } finally {
      if (current()) pending.current = false;
    }
  }, [autoLoadAll, context, enabled, fetchPage, pageSize, scope]);

  const refresh = useCallback(() => request(false), [request]);
  const loadMore = useCallback(() => request(true), [request]);
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [enabled, refresh]);

  const current = enabled && snapshot?.context === context ? snapshot : null;
  return {
    items: current?.items ?? [], total: current?.total ?? null,
    loaded: Boolean(current?.pages), busy: current?.busy ?? enabled,
    hasMore: current?.hasMore ?? false,
    // A complete, retained snapshot stays countable during background revalidation.
    complete: Boolean(current?.pages && !current.hasMore),
    error: current?.error ?? null, refresh, loadMore,
  };
}
