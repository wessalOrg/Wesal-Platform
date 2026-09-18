"use client";

import { useEffect, useRef } from "react";
import { getAudioNotificationService } from "@/lib/audio-notification-service";
import {
  claimNewBookingAlert,
  rememberBookingAlertIds,
  resetBookingAlertIds,
} from "@/lib/played-booking-alerts";
import { subscribeOwnerBookingRequestEvents } from "@/services/booking-notification-realtime";
import type { HallBookingNotification } from "@/types/hall-notifications";

/**
 * Plays a chime for genuinely new owner booking-request realtime events.
 * Historical list rows, re-fetches, and duplicate socket payloads stay silent.
 */
export function useBookingRequestAudio(enabled: boolean) {
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      resetBookingAlertIds();
      return;
    }

    const audio = getAudioNotificationService();
    const unsubscribe = subscribeOwnerBookingRequestEvents((event) => {
      if (!enabledRef.current) return;
      if (event.replay) {
        rememberBookingAlertIds([event.id]);
        return;
      }
      if (!claimNewBookingAlert(event.id)) return;
      void audio.playAlert().catch(() => undefined);
    });

    return () => {
      unsubscribe();
    };
  }, [enabled]);
}

export function useRememberHistoricalBookingAlerts(
  items: HallBookingNotification[],
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    rememberBookingAlertIds(items.map((item) => item.id));
  }, [active, items]);
}
