"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  hallDetailsHref,
  isNavigableHallId,
} from "@/components/assistant/ai-hall-navigation";
import { fetchHallDetails } from "@/services/halls";

const PROBE_MS = 3_000;

export type AiHallNavNotice = {
  hallId: string;
  messageKey: string;
};

type ProbeOutcome = "ok" | "missing" | "timeout";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | "timeout"> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve("timeout"), ms);
    void promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        window.clearTimeout(timer);
        resolve("timeout");
      },
    );
  });
}

async function probeHall(hallId: string): Promise<ProbeOutcome> {
  const raced = await withTimeout(fetchHallDetails(hallId), PROBE_MS);
  if (raced === "timeout") return "timeout";
  if (raced.status === "not_found") return "missing";
  return "ok";
}

/**
 * Opens a recommended hall on the real details route. Lives outside `useAiChat`
 * so the conversation engine never owns routing.
 */
export function useAiHallNavigation() {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<AiHallNavNotice | null>(null);
  const aliveRef = useRef(true);
  const inFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const prefetch = useCallback(
    (hallId: string) => {
      if (!isNavigableHallId(hallId)) return;
      router.prefetch(hallDetailsHref(hallId));
    },
    [router],
  );

  const openHall = useCallback(
    async (hallId: string) => {
      if (!isNavigableHallId(hallId)) {
        setNotice({ hallId: hallId || "missing", messageKey: "assistant.chat.recommend.invalidHall" });
        return;
      }

      const id = hallId.trim();
      if (inFlightRef.current) return;

      setNotice(null);
      inFlightRef.current = true;
      setPendingId(id);

      try {
        const outcome = await probeHall(id);
        if (!aliveRef.current) return;

        if (outcome === "missing") {
          setNotice({ hallId: id, messageKey: "assistant.chat.recommend.missingHall" });
          return;
        }

        router.push(hallDetailsHref(id));
      } finally {
        inFlightRef.current = false;
        if (aliveRef.current) setPendingId(null);
      }
    },
    [router],
  );

  return { openHall, prefetch, pendingId, notice };
}
