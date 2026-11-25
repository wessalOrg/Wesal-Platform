"use client";

import { useCallback, useEffect, useState } from "react";
import NotificationToast from "@/components/notifications/NotificationToast";
import { useNotifications } from "@/hooks/useNotifications";
import { PLATFORM_NOTIFICATION_TOAST } from "@/lib/platform-notifications-store";
import { isCurrentNotificationAccount, type NotificationAccount } from "@/lib/notification-account";
import type { PlatformNotification } from "@/types/platform-notification";

export default function NotificationToastHost() {
  const { account, audience, openNotification } = useNotifications();
  const [toast, setToast] = useState<{ account: NotificationAccount; item: PlatformNotification } | null>(null);
  // Hide synchronously on identity changes; an old popup must never flash for the next user.
  const item = toast?.account === account ? toast.item : null;

  useEffect(() => {
    const onToast = (event: Event) => {
      const next = (event as CustomEvent<typeof toast>).detail;
      if (!next || next.account !== account || !isCurrentNotificationAccount(next.account) ||
        next.item.audience !== audience) return;
      setToast(next);
    };
    window.addEventListener(PLATFORM_NOTIFICATION_TOAST, onToast);
    return () => window.removeEventListener(PLATFORM_NOTIFICATION_TOAST, onToast);
  }, [account, audience]);

  const close = useCallback(() => setToast(null), []);

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
