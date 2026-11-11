"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { fetchFavoritePosts } from "@/services/post-interactions";

/**
 * Loads saved post ids once for Discover heart hydration (GET /favorites).
 * Discover feed DTOs do not include isSavedByCurrentUser.
 */
export function useFavoritePostIds() {
  const { session } = useAuth();
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!session.isAuthenticated) {
      setIds(new Set());
      setReady(true);
      return;
    }
    try {
      const page = await fetchFavoritePosts(1, 100);
      setIds(new Set(page.items.map((item) => item.id).filter(Boolean)));
    } catch {
      setIds(new Set());
    } finally {
      setReady(true);
    }
  }, [session.isAuthenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markSaved = useCallback((postId: string, saved: boolean) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (saved) next.add(postId);
      else next.delete(postId);
      return next;
    });
  }, []);

  return { ids, ready, refresh, markSaved };
}
