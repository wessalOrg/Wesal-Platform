"use client";

import { useCallback, useEffect, useState } from "react";
import NotificationToast from "@/components/notifications/NotificationToast";
import { useNotifications } from "@/hooks/useNotifications";
import { PLATFORM_NOTIFICATION_TOAST } from "@/lib/platform-notifications-store";
import type { PlatformNotification } from "@/types/platform-notification";

export default function NotificationToastHost() {
  const { audience, openNotification } = useNotifications();
  const [item, setItem] = useState<PlatformNotification | null>(null);

  useEffect(() => {
    const onToast = (event: Event) => {
      const next = (event as CustomEvent<PlatformNotification>).detail;
      if (!next || next.audience !== audience) return;
      setItem(next);
    };
    window.addEventListener(PLATFORM_NOTIFICATION_TOAST, onToast);
    return () => window.removeEventListener(PLATFORM_NOTIFICATION_TOAST, onToast);
  }, [audience]);

  const close = useCallback(() => setItem(null), []);

  return (
    <NotificationToast
      item={item}
      onClose={close}
      onAction={(next) => {
        openNotification(next);
        close();
      }}
    />
  );
}
