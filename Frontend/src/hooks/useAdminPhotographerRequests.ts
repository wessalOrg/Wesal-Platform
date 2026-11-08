"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api-error";
import { fetchAdminPhotographerRequests } from "@/services/admin-photographers";
import type {
  AdminPhotographerRequestFilter,
  AdminPhotographerRequestPage,
  AdminPhotographerRequestSummary,
} from "@/types/admin-photographers";

type LoadState = {
  status: "idle" | "loading" | "ready" | "error";
  errorKey: string | null;
  page: AdminPhotographerRequestPage;
};

const EMPTY_PAGE: AdminPhotographerRequestPage = {
  items: [],
  page: 1,
  pageSize: 10,
  totalCount: 0,
  totalPages: 0,
};

export function useAdminPhotographerRequests(
  filter: AdminPhotographerRequestFilter,
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
      const next = await fetchAdminPhotographerRequests(filter, page);
      if (seq !== requestSeq.current) return;
      setState({ status: "ready", errorKey: null, page: next });
    } catch (error) {
      if (seq !== requestSeq.current) return;
      setState({
        status: "error",
        errorKey:
          error instanceof ApiError
            ? error.message || "admin.photographers.queue.errors.loadFailed"
            : "admin.photographers.queue.errors.loadFailed",
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
    items: state.page.items as AdminPhotographerRequestSummary[],
    page: state.page,
    loading: state.status === "loading",
    errorKey: state.errorKey,
    reload,
  };
}
