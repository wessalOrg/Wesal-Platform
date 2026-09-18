"use client";

import { useCallback, useRef, useState } from "react";
import {
  ownerAvailabilityPeriodKey,
} from "@/lib/owner-availability";
import { OwnerAvailabilityError, toOwnerAvailabilityError } from "@/lib/owner-availability-errors";
import { notifyPublicHallsChanged } from "@/lib/public-halls-events";
import { updateHallPeriodAvailability } from "@/services/owner-availability";
import type { BookingPeriodType } from "@/types/booking";
import type {
  OwnerAvailabilityPeriod,
  OwnerAvailabilityPeriodUpdate,
  OwnerPeriodAvailabilityStatus,
} from "@/types/owner-availability";

type UseUpdatePeriodStatusOptions = {
  onOptimistic?: (update: OwnerAvailabilityPeriodUpdate) => void;
  onUpdated?: (update: OwnerAvailabilityPeriodUpdate) => void;
  onRevert?: (update: OwnerAvailabilityPeriodUpdate) => void;
};

export function useUpdatePeriodStatus(options?: UseUpdatePeriodStatusOptions) {
  const [savingKeys, setSavingKeys] = useState<Set<string>>(() => new Set());
  const [errorByKey, setErrorByKey] = useState<Record<string, string>>({});
  const inFlightRef = useRef<Set<string>>(new Set());
  const onOptimisticRef = useRef(options?.onOptimistic);
  const onUpdatedRef = useRef(options?.onUpdated);
  const onRevertRef = useRef(options?.onRevert);
  onOptimisticRef.current = options?.onOptimistic;
  onUpdatedRef.current = options?.onUpdated;
  onRevertRef.current = options?.onRevert;

  const clearError = useCallback((key: string) => {
    setErrorByKey((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const update = useCallback(
    async (input: {
      hallId: string;
      dateIso: string;
      period: OwnerAvailabilityPeriod;
      nextStatus: OwnerPeriodAvailabilityStatus;
    }) => {
      const hallId = input.hallId.trim();
      const dateIso = input.dateIso.trim();
      const periodType = input.period.periodType;
      if (!hallId || !dateIso || !periodType) return null;

      const key = ownerAvailabilityPeriodKey(dateIso, periodType);
      if (inFlightRef.current.has(key)) return null;

      inFlightRef.current.add(key);
      setSavingKeys((current) => {
        const next = new Set(current);
        next.add(key);
        return next;
      });
      clearError(key);

      const previous: OwnerAvailabilityPeriodUpdate = {
        hallId,
        dateIso,
        periodType,
        status: input.period.status,
        label: input.period.label,
        time: input.period.time,
      };
      const optimistic: OwnerAvailabilityPeriodUpdate = {
        ...previous,
        status: input.nextStatus,
      };
      onOptimisticRef.current?.(optimistic);

      try {
        const result = await updateHallPeriodAvailability(hallId, {
          date: dateIso,
          periodType,
          status: input.nextStatus,
        });
        onUpdatedRef.current?.(result);
        notifyPublicHallsChanged();
        return result;
      } catch (err) {
        const mapped =
          err instanceof OwnerAvailabilityError ? err : toOwnerAvailabilityError(err);
        onRevertRef.current?.(previous);
        setErrorByKey((current) => ({
          ...current,
          [key]: mapped.backendMessage || mapped.message,
        }));
        return null;
      } finally {
        inFlightRef.current.delete(key);
        setSavingKeys((current) => {
          if (!current.has(key)) return current;
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
    },
    [clearError],
  );

  return {
    update,
    savingKeys,
    errorByKey,
    clearError,
    isSaving: (dateIso: string, periodType: BookingPeriodType) =>
      savingKeys.has(ownerAvailabilityPeriodKey(dateIso, periodType)),
  };
}
