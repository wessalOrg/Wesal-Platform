"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { normalizeUnreadCount } from "@/lib/unread-badge";
import {
  conversationsUseMock,
  fetchUnreadConversationCount,
} from "@/services/conversations";

type UseUnreadCountOptions = {
  /** Polling interval in ms. Defaults to 30000 (30 s). */
  pollInterval?: number;
};

type UnreadSnapshot = {
  count: number;
  ready: boolean;
  sessionKey: string | null;
};

const DEFAULT_POLL_MS = 30_000;

let snapshot: UnreadSnapshot = {
  count: 0,
  ready: false,
  sessionKey: null,
};
const listeners = new Set<() => void>();
let inFlight = false;
let pollIntervalMs = DEFAULT_POLL_MS;
let pollTimer: number | null = null;
let bootTimer: number | null = null;
let activeSessionKey: string | null = null;
let subscriberCount = 0;

function emit() {
  listeners.forEach((listener) => listener());
}

function setSnapshot(next: UnreadSnapshot) {
  if (
    snapshot.count === next.count &&
    snapshot.ready === next.ready &&
    snapshot.sessionKey === next.sessionKey
  ) {
    return;
  }
  snapshot = next;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot(): UnreadSnapshot {
  return { count: 0, ready: false, sessionKey: null };
}

async function pullUnreadCount(sessionKey: string | null): Promise<void> {
  if (!sessionKey) {
    setSnapshot({ count: 0, ready: true, sessionKey: null });
    return;
  }

  if (conversationsUseMock()) {
    setSnapshot({ count: 0, ready: true, sessionKey });
    return;
  }

  if (inFlight) return;
  inFlight = true;
  try {
    const n = normalizeUnreadCount(await fetchUnreadConversationCount());
    // Drop late responses after logout / user switch.
    if (activeSessionKey !== sessionKey) return;
    setSnapshot({ count: n, ready: true, sessionKey });
  } catch {
    if (activeSessionKey !== sessionKey) return;
    // Keep prior valid count for this session; never invent values.
    setSnapshot({
      count: snapshot.sessionKey === sessionKey ? snapshot.count : 0,
      ready: snapshot.sessionKey === sessionKey ? snapshot.ready : false,
      sessionKey,
    });
  } finally {
    inFlight = false;
  }
}

function stopPolling() {
  if (bootTimer != null) {
    window.clearTimeout(bootTimer);
    bootTimer = null;
  }
  if (pollTimer != null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling(sessionKey: string | null) {
  stopPolling();
  if (!sessionKey) {
    void pullUnreadCount(null);
    return;
  }

  // Defer first fetch so React effects stay sync-setState free.
  bootTimer = window.setTimeout(() => {
    void pullUnreadCount(sessionKey);
  }, 0);
  pollTimer = window.setInterval(() => {
    void pullUnreadCount(sessionKey);
  }, pollIntervalMs);
}

function bindSession(sessionKey: string | null) {
  if (activeSessionKey === sessionKey && (pollTimer != null || !sessionKey)) {
    return;
  }
  activeSessionKey = sessionKey;
  inFlight = false;
  setSnapshot({
    count: 0,
    ready: false,
    sessionKey,
  });
  if (subscriberCount > 0) {
    startPolling(sessionKey);
  }
}

/** Force a refresh for the active authenticated session (e.g. after mark-as-read). */
export function refreshUnreadCount(): Promise<void> {
  return pullUnreadCount(activeSessionKey);
}

/**
 * Shared unread-conversation counter for the current authenticated user.
 * Multiple consumers share one poller / one source of truth.
 */
export function useUnreadCount(options?: UseUnreadCountOptions) {
  const { ready, authenticated, sessionKey } = useAccountAccess();
  const ownerKey = ready && authenticated ? sessionKey : null;
  const interval = options?.pollInterval ?? DEFAULT_POLL_MS;

  useEffect(() => {
    pollIntervalMs = interval;
  }, [interval]);

  useEffect(() => {
    subscriberCount += 1;
    bindSession(ownerKey);
    if (subscriberCount === 1) {
      startPolling(ownerKey);
    } else if (activeSessionKey === ownerKey && pollTimer == null && ownerKey) {
      startPolling(ownerKey);
    }

    return () => {
      subscriberCount = Math.max(0, subscriberCount - 1);
      if (subscriberCount === 0) {
        stopPolling();
      }
    };
  }, [ownerKey]);

  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const refresh = useCallback(() => {
    return pullUnreadCount(ownerKey);
  }, [ownerKey]);

  const belongsToSession = snap.sessionKey === ownerKey;

  return {
    count: belongsToSession ? snap.count : 0,
    ready: Boolean(ready && belongsToSession && snap.ready),
    refresh,
  };
}
