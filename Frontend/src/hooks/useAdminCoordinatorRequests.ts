"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api-error";
import { fetchAdminCoordinatorRequests } from "@/services/admin-coordinators";
import type {
  AdminCoordinatorRequestFilter,
  AdminCoordinatorRequestPage,
  AdminCoordinatorRequestSummary,
} from "@/types/admin-coordinators";

type LoadState = {
  status: "idle" | "loading" | "ready" | "error";
  errorKey: string | null;
  page: AdminCoordinatorRequestPage;
};

const EMPTY_PAGE: AdminCoordinatorRequestPage = {
  items: [],
  page: 1,
  pageSize: 10,
  totalCount: 0,
  totalPages: 0,
};

export function useAdminCoordinatorRequests(
  filter: AdminCoordinatorRequestFilter,
  page: number,
) {
  const [state, setState] = useState<LoadState>({
    status: "loading",
    errorKey: null,
    page: EMPTY_PAGE,
  });
  const requestSeq = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++requestSeq.current;
    setState((current) => ({
      ...current,
      status: "loading",
      errorKey: null,
    }));
    try {
      const next = await fetchAdminCoordinatorRequests(filter, page);
      if (seq !== requestSeq.current) return;
      setState({ status: "ready", errorKey: null, page: next });
    } catch (error) {
      if (seq !== requestSeq.current) return;
      setState({
        status: "error",
        errorKey:
          error instanceof ApiError
            ? error.message || "admin.coordinators.queue.errors.loadFailed"
            : "admin.coordinators.queue.errors.loadFailed",
        page: EMPTY_PAGE,
      });
    }
  }, [filter, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  return {
    items: state.page.items as AdminCoordinatorRequestSummary[],
    page: state.page,
    loading: state.status === "loading",
    errorKey: state.errorKey,
    reload,
  };
}
