"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  getAudioNotificationService,
  getAudioPermissionSnapshot,
  subscribeAudioPermission,
  type AudioPermissionSnapshot,
  type AudioPermissionStatus,
} from "@/lib/audio-notification-service";

type AudioPermissionContextValue = AudioPermissionSnapshot & {
  soundOn: boolean;
  enable: () => Promise<boolean>;
  toggleMute: () => Promise<void>;
  dismissMissedAlert: () => void;
};

const AudioPermissionContext = createContext<AudioPermissionContextValue | null>(null);

const SERVER_SNAPSHOT: AudioPermissionSnapshot = {
  status: "pending",
  muted: false,
  missedAlert: false,
};

function getServerSnapshot(): AudioPermissionSnapshot {
  return SERVER_SNAPSHOT;
}

export function AudioPermissionProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribeAudioPermission,
    getAudioPermissionSnapshot,
    getServerSnapshot,
  );

  const enable = useCallback(async () => {
    return getAudioNotificationService().enable();
  }, []);

  const toggleMute = useCallback(async () => {
    const audio = getAudioNotificationService();
    const current = audio.getSnapshot();
    if (current.muted || current.status !== "allowed") {
      await audio.enable();
      return;
    }
    audio.setMuted(true);
  }, []);

  const dismissMissedAlert = useCallback(() => {
    getAudioNotificationService().clearMissedAlert();
  }, []);

  const value = useMemo<AudioPermissionContextValue>(
    () => ({
      ...snapshot,
      soundOn: snapshot.status === "allowed" && !snapshot.muted,
      enable,
      toggleMute,
      dismissMissedAlert,
    }),
    [snapshot, enable, toggleMute, dismissMissedAlert],
  );

  return (
    <AudioPermissionContext.Provider value={value}>{children}</AudioPermissionContext.Provider>
  );
}

export function useAudioPermission(): AudioPermissionContextValue {
  const context = useContext(AudioPermissionContext);
  if (context) return context;

  return {
    ...SERVER_SNAPSHOT,
    soundOn: false,
    enable: async () => false,
    toggleMute: async () => undefined,
    dismissMissedAlert: () => undefined,
  };
}

export type { AudioPermissionStatus };
