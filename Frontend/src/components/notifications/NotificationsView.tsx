"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useT } from "@/i18n";

export default function NotificationsView() {
  const t = useT();
  const router = useRouter();
  const { session, status, isLoggingOut } = useAuth();
  const hadSessionRef = useRef(false);

  useEffect(() => {
    if (status === "loading" || isLoggingOut) return;
    if (session.isAuthenticated) {
      hadSessionRef.current = true;
      return;
    }
    if (hadSessionRef.current) {
      hadSessionRef.current = false;
      return;
    }
    router.replace("/login?redirect=/notifications");
  }, [isLoggingOut, router, session.isAuthenticated, status]);

  if (status === "loading" || !session.isAuthenticated) {
    return (
      <div
        className="h-48 animate-pulse rounded-2xl bg-white"
        aria-busy="true"
        data-testid="notifications-loading"
      />
    );
  }

  return (
    <section
      className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(90,55,45,0.08)]"
      data-testid="notifications-view"
    >
      <h1 className="text-2xl font-bold text-[var(--wesal-maroon)]">
        {t("notifications.title")}
      </h1>
      <p className="mt-2 text-sm leading-7 text-[var(--wesal-muted)]">
        {t("notifications.subtitle")}
      </p>
      <p className="mt-8 text-sm leading-7 text-[var(--wesal-text)]">
        {t("notifications.empty")}
      </p>
    </section>
  );
}
