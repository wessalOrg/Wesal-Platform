"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthenticatedRequestScope } from "@/hooks/useAuthenticatedRequestScope";
import {
  captureFavoriteRead, getPostFavoritesSnapshot, getServerPostFavoritesSnapshot,
  hydratePostFavorites, markPostSaved, observeFavoritePage, rememberPostSaveCount,
  savedPostState, setPostSaved, subscribePostFavorites, type FavoriteRead,
} from "@/lib/post-favorites-store";
import type { FavoritePost, PagedResult } from "@/types/posts";

/** Shared, account-scoped state. Partial pages establish only positive membership. */
export function useFavoritePostIds({ hydrate = true }: { hydrate?: boolean } = {}) {
  const { session } = useAuth();
  const { account, isCurrent } = useAuthenticatedRequestScope(session.isAuthenticated);
  const snapshot = useSyncExternalStore(subscribePostFavorites, getPostFavoritesSnapshot, getServerPostFavoritesSnapshot);
  const visible = session.isAuthenticated && account ? snapshot : getServerPostFavoritesSnapshot();
  useEffect(() => {
    if (hydrate && isCurrent()) void hydratePostFavorites(account);
  }, [hydrate, account, isCurrent]);
  const refresh = useCallback(() => isCurrent() ? hydratePostFavorites(account, true) : Promise.resolve(), [account, isCurrent]);
  const markSaved = useCallback((id: string, saved: boolean) => {
    if (isCurrent()) markPostSaved(account, id, saved);
  }, [account, isCurrent]);
  const setSaved = useCallback((id: string, saved: boolean) =>
    isCurrent() ? setPostSaved(account, id, saved) : Promise.resolve(false), [account, isCurrent]);
  const captureRead = useCallback(() => captureFavoriteRead(isCurrent() ? account : null), [account, isCurrent]);
  const observePage = useCallback((page: PagedResult<FavoritePost>, read: FavoriteRead) => {
    if (isCurrent()) observeFavoritePage(account, page, read);
  }, [account, isCurrent]);
  const rememberCount = useCallback((id: string, count: number) => {
    if (isCurrent()) rememberPostSaveCount(account, id, count);
  }, [account, isCurrent]);
  const savedFor = useCallback((id: string) => savedPostState(visible, id), [visible]);
  return {
    ids: visible.ids, ready: !session.isAuthenticated || visible.complete,
    loading: Boolean(account) && (visible.status === "idle" || visible.status === "loading"),
    errorKey: visible.errorKey, errors: visible.errors, pending: visible.pending, requiresLogin: visible.requiresLogin,
    counts: visible.counts, revision: visible.revision,
    refresh, markSaved, setSaved, savedFor, captureRead, observePage, rememberCount,
  };
}
