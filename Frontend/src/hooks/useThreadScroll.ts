"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const NEAR_BOTTOM_PX = 96;

/**
 * Auto-scrolls only while the reader is already near the latest message.
 * Incoming messages while browsing history raise an unseen count instead.
 */
export function useThreadScroll(
  conversationId: string | null,
  itemCount: number,
  lastIsRejection = false,
) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const prevCountRef = useRef(0);
  const [unseenCount, setUnseenCount] = useState(0);
  const [unseenRejection, setUnseenRejection] = useState(false);

  const syncPin = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    const pinned = gap <= NEAR_BOTTOM_PX;
    pinnedRef.current = pinned;
    if (pinned) {
      setUnseenCount(0);
      setUnseenRejection(false);
    }
  }, []);

  const scrollToLatest = useCallback((smooth = false) => {
    const run = () => {
      const el = scrollerRef.current;
      if (!el) return;
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
      pinnedRef.current = true;
      setUnseenCount(0);
      setUnseenRejection(false);
    };
    requestAnimationFrame(run);
  }, []);

  useEffect(() => {
    pinnedRef.current = true;
    prevCountRef.current = 0;
    setUnseenCount(0);
    setUnseenRejection(false);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    const previous = prevCountRef.current;
    const grew = itemCount > previous;
    prevCountRef.current = itemCount;
    if (!grew) return;
    if (previous === 0 || pinnedRef.current) {
      scrollToLatest(false);
      return;
    }
    setUnseenCount((count) => count + (itemCount - previous));
    if (lastIsRejection) setUnseenRejection(true);
  }, [conversationId, itemCount, lastIsRejection, scrollToLatest]);

  return {
    scrollerRef,
    unseenCount,
    unseenRejection,
    onScroll: syncPin,
    scrollToLatest,
  };
}
