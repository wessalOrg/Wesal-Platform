"use client";

import { useEffect } from "react";
import AudioPermissionToast from "@/components/halls/notifications/AudioPermissionToast";
import { useBookingRequestAudio } from "@/hooks/useBookingRequestAudio";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { getAudioNotificationService } from "@/lib/audio-notification-service";

export default function HallOwnerAudioAlerts() {
  const { ready, authenticated, isHallOwner } = useAccountAccess();
  const enabled = ready && authenticated && isHallOwner;

  useBookingRequestAudio(enabled);

  useEffect(() => {
    if (!enabled) return;
    const audio = getAudioNotificationService();
    audio.bindUnlockGestures();
    return () => {
      audio.unbindUnlockGestures();
    };
  }, [enabled]);

  if (!enabled) return null;

  return <AudioPermissionToast />;
}
