"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  isCurrentAuthenticatedAccount,
  readAuthenticatedAccount,
  serverAuthenticatedAccount,
  subscribeAuthenticatedAccount,
  type AuthenticatedAccount,
} from "@/lib/authenticated-account";
import { createRequestScope } from "@/lib/request-scope";
import { getStoredAuth } from "@/lib/auth-storage";
import { isProfessionalRole } from "@/lib/account-role";
import { conversationTimeValue } from "@/lib/conversation-mapper";
import { isAdminAccountConversation } from "@/lib/admin-account-conversation";
import {
  conversationErrorMessage,
  fetchInboxConversations,
  fetchProfessionalConversationPage,
  type ProfessionalConversationPage,
  fetchMyAdminAccountConversation,
} from "@/services/conversations";
import type { ConversationSummary, InboxStatus } from "@/types/messages";

function mergeAdminAccountRow(
  items: ConversationSummary[],
  adminRow: ConversationSummary | null,
): ConversationSummary[] {
  if (!adminRow) return items;
  const withoutDup = items.filter(
    (item) => item.conversationId !== adminRow.conversationId && !isAdminAccountConversation(item),
  );
  const existing = items.find((item) => item.conversationId === adminRow.conversationId);
  const merged: ConversationSummary = existing
    ? {
        ...existing,
        kind: "AdminAccount",
        hallId: "",
        hallName: "",
        otherParticipantId: existing.otherParticipantId || "admin",
        otherParticipantName: adminRow.otherParticipantName,
        // §13.1 — admin DTO has no unread; prefer the dedicated unread-count patch.
        unreadMessageCount: adminRow.unreadMessageCount,
        isUnread: adminRow.isUnread,
      }
    : adminRow;
  return [merged, ...withoutDup].sort(
    (left, right) =>
      conversationTimeValue(right.lastMessageAt ?? right.createdAt) -
      conversationTimeValue(left.lastMessageAt ?? left.createdAt),
  );
}

type PageMetadata = Omit<ProfessionalConversationPage, "items">;
type InboxLoad = { items: ConversationSummary[]; pagination: PageMetadata | null; customerError: string | null };

async function loadInbox(professional: boolean, includeAdminAccount: boolean, current: () => boolean, signal: AbortSignal): Promise<InboxLoad> {
  if (!professional) return { items: await fetchInboxConversations(), pagination: null, customerError: null };
  let page: ProfessionalConversationPage | null = null;
  let failure: unknown;
  try { page = await fetchProfessionalConversationPage(1, signal); } catch (error) { failure = error; }
  if (!current()) return { items: [], pagination: null, customerError: null };
  let adminRow: ConversationSummary | null = null;
  if (includeAdminAccount) {
    try { adminRow = await fetchMyAdminAccountConversation(); } catch { /* A missing admin thread must not hide customers. */ }
  }
  if (!page && !adminRow) throw failure;
  const { items, ...pagination } = page ?? { items: [] };
  return { items: mergeAdminAccountRow(items, adminRow), pagination: page ? pagination as PageMetadata : null,
    customerError: failure ? conversationErrorMessage(failure, "inbox") : null };
}

/** Same ordering as the backend: latest activity, then conversation ID, both descending. */
function orderConversations(items: ConversationSummary[]): ConversationSummary[] {
  return [...items].sort((left, right) =>
    conversationTimeValue(right.lastMessageAt ?? right.createdAt) - conversationTimeValue(left.lastMessageAt ?? left.createdAt)
    || right.conversationId.localeCompare(left.conversationId));
}

type InboxContext = { ownerKey: string; account: AuthenticatedAccount; includeAdminAccount: boolean; professional: boolean };
type RowPatch = (row: ConversationSummary) => ConversationSummary;
/** Mutable transport bookkeeping stays inside a session-owned controller, outside React state. */
function createInboxScope(context: InboxContext | null) {
  const guard = createRequestScope();
  let controller: AbortController | null = null;
  let nextPage = 1;
  let morePending = false;
  let revision = 0;
  const changed = new Map<string, number>();
  const patches = new Map<string, RowPatch>();
  let pending = false;
  const begin = () => {
    controller?.abort(); controller = new AbortController(); patches.clear(); pending = true;
    return controller;
  };
  return {
    context, ...guard,
    dispose() { guard.dispose(); controller?.abort(); patches.clear(); pending = false; },
    beginLoad() { morePending = false; return begin(); },
    beginMore() { if (morePending) return null; morePending = true; return begin(); },
    finishRequest(request: AbortController) {
      if (controller === request) { morePending = false; pending = false; patches.clear(); }
    },
    nextPage: () => nextPage,
    resetPage() { nextPage = 1; },
    receivePage(page: number) { nextPage = Math.max(nextPage, page + 1); },
    revision: () => revision,
    recordChange(id: string) { changed.set(id, ++revision); },
    recordPatch(id: string, patch: RowPatch) {
      if (!pending) return;
      const previous = patches.get(id);
      patches.set(id, previous ? row => patch(previous(row)) : patch);
    },
    patchRows: (items: ConversationSummary[]) => items.map(row => patches.get(row.conversationId)?.(row) ?? row),
    changedAfter: (id: string, since: number) => (changed.get(id) ?? 0) > since,
  };
}

type InboxState = {
  context: InboxContext | null;
  status: InboxStatus;
  conversations: ConversationSummary[];
  error: string | null;
  pagination: PageMetadata | null;
  loadingMore: boolean;
  loadMoreError: string | null;
  hasMore: boolean;
};

function emptyInbox(context: InboxContext | null): InboxState {
  return { context, status: context ? "loading" : "idle", conversations: [], error: null, pagination: null, loadingMore: false, loadMoreError: null, hasMore: false };
}

/**
 * Inbox list for a single auth session. Closing the panel (`active=false`)
 * parks the data; logout (`ownerKey=null`) wipes it.
 */
export function useInboxConversations(
  ownerKey: string | null,
  active: boolean,
  includeAdminAccount = false,
) {
  const account = useSyncExternalStore(
    subscribeAuthenticatedAccount, readAuthenticatedAccount, serverAuthenticatedAccount,
  );
  const user = getStoredAuth()?.user;
  const professional = includeAdminAccount || isProfessionalRole(user?.role ?? user?.accountType);
  const context = useMemo<InboxContext | null>(() => {
    if (!account || !ownerKey || (ownerKey !== account.userId && ownerKey !== account.token)) return null;
    return { account, ownerKey, includeAdminAccount, professional };
  }, [account, ownerKey, includeAdminAccount, professional]);
  const scope = useMemo(() => createInboxScope(context), [context]);
  useLayoutEffect(() => {
    scope.activate();
    return () => scope.dispose();
  }, [scope]);

  const [state, setState] = useState<InboxState>(() => emptyInbox(null));
  // Mask old data in the render that changes identity, before effect cleanup runs.
  const visible = state.context === context ? state : emptyInbox(context);

  const startLoad = useCallback((refreshOnly = false) => {
    if (!context || !scope.isActive() || !isCurrentAuthenticatedAccount(context.account)) return;
    const controller = scope.beginLoad();
    const latest = scope.latest("inbox");
    const revision = scope.revision();
    let cancelled = false;
    const current = () => !cancelled && latest() && isCurrentAuthenticatedAccount(context.account);
    void loadInbox(context.professional, context.includeAdminAccount, current, controller.signal)
      .then(({ items, pagination, customerError }) => {
        if (!current()) return;
        const patchedItems = scope.patchRows(items);
        if (pagination) scope.receivePage(pagination.pageNumber); else scope.resetPage();
        setState(previous => {
          if (!current()) return previous;
          const existing = previous.context === context ? previous.conversations : [];
          const byId = new Map(existing.map(row => [row.conversationId, row]));
          const incoming = patchedItems.map(row => scope.changedAfter(row.conversationId, revision)
            ? byId.get(row.conversationId) ?? row : row);
          // Keep user-loaded later pages on professional refresh; other inboxes keep their full-list behavior.
          const merged = context.professional ? new Map(existing.map(row => [row.conversationId, row])) : new Map<string, ConversationSummary>();
          for (const row of incoming) merged.set(row.conversationId, row);
          const canonicalAdmin = items.find(isAdminAccountConversation);
          if (canonicalAdmin) for (const [id, row] of merged) {
            if (isAdminAccountConversation(row) && id !== canonicalAdmin.conversationId) merged.delete(id);
          }
          const conversations = orderConversations([...merged.values()]);
          return { context, conversations, pagination, status: conversations.length ? "ready" : "empty", error: null,
            loadingMore: false, loadMoreError: customerError,
            hasMore: Boolean(customerError || (pagination && scope.nextPage() <= pagination.totalPages)) };
        });
      })
      .catch((err) => {
        if (!current()) return;
        if (refreshOnly) {
          setState(previous => previous.context === context ? { ...previous, loadingMore: false } : previous);
          return;
        }
        setState({ ...emptyInbox(context), status: "error", error: conversationErrorMessage(err, "inbox") });
      }).finally(() => scope.finishRequest(controller));
    return () => { cancelled = true; controller.abort(); };
  }, [context, scope]);

  useEffect(() => {
    if (active) return startLoad();
  }, [active, startLoad]);

  const refresh = useCallback(() => {
    setState(previous => previous.context === context ? { ...previous, loadingMore: false, loadMoreError: null } : previous);
    startLoad(true);
  }, [context, startLoad]);

  const retry = useCallback(() => {
    if (!context || !scope.isActive() || !isCurrentAuthenticatedAccount(context.account)) return;
    scope.latest("inbox");
    scope.resetPage();
    setState(emptyInbox(context));
    if (active) startLoad();
  }, [active, context, scope, startLoad]);

  const loadMore = useCallback(() => {
    if (!context?.professional || !visible.hasMore ||
        !scope.isActive() || !isCurrentAuthenticatedAccount(context.account)) return;
    const controller = scope.beginMore();
    if (!controller) return;
    const page = scope.nextPage();
    const latest = scope.latest("inbox");
    const current = () => latest() && isCurrentAuthenticatedAccount(context.account);
    setState(previous => previous.context === context ? { ...previous, loadingMore: true, loadMoreError: null } : previous);
    void fetchProfessionalConversationPage(page, controller.signal).then(({ items, ...pagination }) => {
      if (!current()) return;
      const patchedItems = scope.patchRows(items);
      scope.receivePage(pagination.pageNumber);
      setState(previous => {
        if (!current() || previous.context !== context) return previous;
        // Already-visible rows may have newer realtime or read-state updates than this response.
        const merged = new Map(previous.conversations.map(row => [row.conversationId, row]));
        for (const row of patchedItems) if (!merged.has(row.conversationId)) merged.set(row.conversationId, row);
        return { ...previous, conversations: orderConversations([...merged.values()]), pagination,
          status: merged.size ? "ready" : "empty", loadingMore: false, loadMoreError: null, hasMore: pagination.hasNextPage };
      });
    }).catch(error => {
      if (current()) setState(previous => previous.context === context
        ? { ...previous, loadingMore: false, loadMoreError: conversationErrorMessage(error, "inbox") } : previous);
    }).finally(() => scope.finishRequest(controller));
  }, [context, scope, visible.hasMore]);

  const update = useCallback((change: (current: InboxState) => InboxState, conversationId: string, patch?: RowPatch) => {
    if (!context || !scope.isActive() || !isCurrentAuthenticatedAccount(context.account)) return;
    scope.recordChange(conversationId);
    if (patch) scope.recordPatch(conversationId, patch);
    setState((current) => {
      if (!scope.isActive() || !isCurrentAuthenticatedAccount(context.account)) return current;
      return change(current.context === context ? current : emptyInbox(context));
    });
  }, [context, scope]);

  const markLocalRead = useCallback((conversationId: string) => {
    update((current) => ({ ...current,
      conversations: current.conversations.map((item) =>
        item.conversationId === conversationId
          ? { ...item, isUnread: false, unreadMessageCount: 0 }
          : item,
      ),
    }), conversationId, item => ({ ...item, isUnread: false, unreadMessageCount: 0 }));
  }, [update]);

  const applyUnreadCount = useCallback(
    (conversationId: string | null | undefined, unreadMessageCount: number) => {
      if (!conversationId) return;
      const count = Math.max(0, unreadMessageCount);
      update((current) => ({ ...current,
        conversations: current.conversations.map((item) =>
          item.conversationId === conversationId
            ? { ...item, unreadMessageCount: count, isUnread: count > 0 }
            : item,
        ),
      }), conversationId, item => ({ ...item, unreadMessageCount: count, isUnread: count > 0 }));
    },
    [update],
  );

  const applyPreview = useCallback((
    conversationId: string,
    preview: string,
    at: string,
    unread = true,
    hasAttachment = false,
  ) => {
    update((current) => {
      const next = current.conversations.map((item) =>
        item.conversationId === conversationId
          ? {
              ...item,
              lastMessagePreview: preview,
              lastMessageHasAttachment: hasAttachment,
              lastMessageAt: at,
              isUnread: unread,
              unreadMessageCount: unread
                ? Math.max(1, (item.unreadMessageCount || 0) + 1)
                : 0,
            }
          : item,
      );
      const conversations = [...next].sort(
        (left, right) =>
          conversationTimeValue(right.lastMessageAt ?? right.createdAt) -
          conversationTimeValue(left.lastMessageAt ?? left.createdAt),
      );
      return { ...current, conversations, status: current.status === "empty" ? "ready" : current.status };
    }, conversationId, item => {
      // A fresh API snapshot may already contain this message; don't count it twice.
      if (conversationTimeValue(item.lastMessageAt ?? item.createdAt) >= conversationTimeValue(at)) return item;
      return { ...item, lastMessagePreview: preview, lastMessageHasAttachment: hasAttachment, lastMessageAt: at,
        isUnread: unread, unreadMessageCount: unread ? Math.max(1, (item.unreadMessageCount || 0) + 1) : 0 };
    });
  }, [update]);

  const ensureConversation = useCallback((row: ConversationSummary) => {
    if (!row.conversationId) return;
    update((current) => {
      const exists = current.conversations.some((item) => item.conversationId === row.conversationId);
      return { ...current, conversations: exists ? current.conversations : mergeAdminAccountRow(current.conversations, row),
        status: current.status === "empty" || current.status === "idle" || current.status === "loading" ? "ready" : current.status,
        error: null };
    }, row.conversationId);
  }, [update]);

  return {
    status: visible.status,
    conversations: visible.conversations,
    error: visible.error,
    retry,
    refresh,
    loadMore,
    hasMore: visible.hasMore,
    loadingMore: visible.loadingMore,
    loadMoreError: visible.loadMoreError,
    totalCount: visible.pagination?.totalCount ?? null,
    ensureConversation,
    applyPreview,
    applyUnreadCount,
    markLocalRead,
  };
}
