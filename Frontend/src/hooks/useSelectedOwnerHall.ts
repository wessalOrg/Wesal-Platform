"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import { parseOwnerHallIdFromPathname } from "@/lib/hall-owner-query-keys";
import type { HallOwnerHall } from "@/types/hall-owner-halls";

/**
 * Selected Hall identity is the route param (single source of truth).
 * Derives the Hall summary from the owner halls list when available.
 */
export function useSelectedOwnerHall(): {
  selectedHallId: string | null;
  selectedHall: HallOwnerHall | null;
  halls: HallOwnerHall[];
  isListLoading: boolean;
  isListReady: boolean;
  isKnownOwnedHall: boolean;
} {
  const pathname = usePathname();
  const { halls, isLoading, status } = useHallOwnerHalls();

  const selectedHallId = useMemo(
    () => parseOwnerHallIdFromPathname(pathname),
    [pathname],
  );

  const selectedHall = useMemo(() => {
    if (!selectedHallId) return null;
    return halls.find((hall) => hall.id === selectedHallId) ?? null;
  }, [halls, selectedHallId]);

  const isListReady = status === "ready";
  const isKnownOwnedHall = Boolean(
    selectedHallId && halls.some((hall) => hall.id === selectedHallId),
  );

  return {
    selectedHallId,
    selectedHall,
    halls,
    isListLoading: isLoading,
    isListReady,
    isKnownOwnedHall,
  };
}
