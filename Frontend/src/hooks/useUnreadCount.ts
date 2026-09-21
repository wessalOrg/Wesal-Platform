"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchUnreadConversationCount } from "@/services/conversations";
import { conversationsUseMock } from "@/services/conversations";

type UseUnreadCountOptions = {
  /** Polling interval in ms. Defaults to 30000 (30 s). */
  pollInterval?: number;
};

export function useUnreadCount(options?: UseUnreadCountOptions) {
  const interval = options?.pollInterval ?? 30_000;
  const [count, setCount] = useState(0);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (conversationsUseMock()) {
      setCount(0);
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const n = await fetchUnreadConversationCount();
      setCount(n);
    } catch {
      // silent — keep previous count
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, interval);
    return () => clearInterval(id);
  }, [refresh, interval]);

  return { count, refresh };
}
