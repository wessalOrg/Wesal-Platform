"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAdminRejectedHalls } from "@/services/admin-halls";
import type { AdminHallPage } from "@/lib/admin-halls-mapper";

const EMPTY_PAGE: AdminHallPage = {
  items: [],
  page: 1,
  pageSize: 10,
  totalCount: 0,
  totalPages: 0,
};

export function useAdminRejectedHalls() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AdminHallPage>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(async (requestedPage: number) => {
    setLoading(true);
    setErrorKey(null);
    try {
      const next = await fetchAdminRejectedHalls(requestedPage);
      if (next.items.length === 0 && requestedPage > 1 && next.totalPages > 0 && requestedPage > next.totalPages) {
        setPage(next.totalPages);
        return;
      }
      setResult(next);
    } catch {
      setResult(EMPTY_PAGE);
      setErrorKey("admin.halls.rejected.errors.loadFailed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(page);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, page]);

  return {
    halls: result.items,
    page: result.page,
    totalPages: result.totalPages,
    loading,
    errorKey,
    reload: () => load(page),
    goToPage: setPage,
  };
}
