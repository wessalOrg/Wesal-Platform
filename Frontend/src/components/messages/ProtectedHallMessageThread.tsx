"use client";

import type { ReactNode } from "react";
import HallBookingDataGate from "@/components/halls/HallBookingDataGate";
import { useOwnedHallAccess } from "@/hooks/useOwnedHallAccess";

type ProtectedHallMessageThreadProps = {
  hallId: string | null | undefined;
  children: ReactNode;
};

/** Blocks owner messaging content when payment is required or the hall is locked. Seekers pass through. */
export default function ProtectedHallMessageThread({
  hallId,
  children,
}: ProtectedHallMessageThreadProps) {
  const { access, flagsReady } = useOwnedHallAccess(hallId ?? null);

  return (
    <HallBookingDataGate access={access} flagsReady={flagsReady}>
      {children}
    </HallBookingDataGate>
  );
}
