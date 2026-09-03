"use client";

import { useEffect, useRef, useState } from "react";
import { isBookingRejectionContent } from "@/lib/booking-rejection-message";
import type { ThreadMessage } from "@/types/messages";

/** Highlights a rejection that arrived after the thread was already on screen. */
export function useRejectionArrival(conversationId: string | null, messages: ThreadMessage[]) {
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);
  const [arrivingId, setArrivingId] = useState<string | null>(null);

  useEffect(() => {
    seenRef.current = new Set();
    primedRef.current = false;
    setArrivingId(null);
  }, [conversationId]);

  useEffect(() => {
    const ids = messages.map((item) => item.id);
    if (!primedRef.current) {
      seenRef.current = new Set(ids);
      primedRef.current = true;
      return;
    }

    const fresh = messages.find(
      (item) => !seenRef.current.has(item.id) && isBookingRejectionContent(item.content),
    );
    seenRef.current = new Set(ids);
    if (!fresh) return;

    setArrivingId(fresh.id);
    const timer = window.setTimeout(() => setArrivingId(null), 2800);
    return () => window.clearTimeout(timer);
  }, [messages]);

  return arrivingId;
}
