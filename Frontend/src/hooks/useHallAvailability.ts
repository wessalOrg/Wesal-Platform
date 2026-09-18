"use client";

import { useCallback, useEffect, useState } from "react";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { hallAvailabilityErrorMessageKey, toOwnerAvailabilityError } from "@/lib/owner-availability-errors";
import { patchOwnerAvailabilityDay } from "@/lib/owner-availability";
import { fetchHallAvailability } from "@/services/owner-availability";
import type {
  OwnerAvailabilityDay,
  OwnerAvailabilityLoadStatus,
  OwnerAvailabilityPeriodUpdate,
} from "@/types/owner-availability";

function loadStatusFromError(
  kind: ReturnType<typeof toOwnerAvailabilityError>["kind"],
): OwnerAvailabilityLoadStatus {
  if (kind === "unauthorized") return "unauthorized";
  if (kind === "forbidden") return "forbidden";
  if (kind === "not_found") return "not_found";
  return "error";
}

/**
 * Month-scoped owner availability. Changing hall or month drops the previous set.
 */
export function useHallAvailability(hallId: string | null, month: string, enabled: boolean) {
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const scopedId = enabled && hallId?.trim() ? hallId.trim() : null;
  const scopeKey = scopedId ? `${scopedId}::${month}` : null;
  const [seenKey, setSeenKey] = useState<string | null>(scopeKey);
  const [retryTick, setRetryTick] = useState(0);
  const [status, setStatus] = useState<OwnerAvailabilityLoadStatus>(scopeKey ? "loading" : "idle");
  const [days, setDays] = useState<OwnerAvailabilityDay[]>([]);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  if (scopeKey !== seenKey) {
    setSeenKey(scopeKey);
    setDays([]);
    setErrorKey(null);
    setStatus(scopeKey ? "loading" : "idle");
  }

  useEffect(() => {
    if (!scopedId) return;

    const controller = new AbortController();
    let cancelled = false;

    void fetchHallAvailability(scopedId, month, locale, controller.signal)
      .then((next) => {
        if (cancelled) return;
        setDays(next);
        setErrorKey(null);
        setStatus(next.length === 0 ? "empty" : "ready");
      })
      .catch((err: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        const mapped = toOwnerAvailabilityError(err);
        setDays([]);
        setErrorKey(hallAvailabilityErrorMessageKey(mapped.kind));
        setStatus(loadStatusFromError(mapped.kind));
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [scopedId, month, locale, retryTick]);

  const retry = useCallback(() => {
    if (!scopedId) return;
    setDays([]);
    setErrorKey(null);
    setStatus("loading");
    setRetryTick((tick) => tick + 1);
  }, [scopedId]);

  const applyPeriod = useCallback((update: OwnerAvailabilityPeriodUpdate) => {
    setDays((current) => patchOwnerAvailabilityDay(current, update));
  }, []);

  return {
    hallId: scopedId,
    status,
    days,
    errorKey,
    retry,
    applyPeriod,
  };
}
