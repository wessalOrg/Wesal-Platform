"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useT } from "@/i18n";
import { getStoredAuth } from "@/lib/auth-storage";

export default function ProfileView() {
  const t = useT();
  const router = useRouter();
  const { session, status, logout, isLoggingOut } = useAuth();
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
    router.replace("/login?redirect=/profile");
  }, [isLoggingOut, router, session.isAuthenticated, status]);

  if (status === "loading" || !session.isAuthenticated) {
    return (
      <div
        className="h-48 animate-pulse rounded-2xl bg-white"
        aria-busy="true"
        data-testid="profile-loading"
      />
    );
  }

  const email = getStoredAuth()?.user.email?.trim() || null;
  const name = session.userName?.trim() || t("nav.account");
  const role =
    session.role === "HallOwner"
      ? t("nav.role.hallOwner")
      : session.role === "Admin"
        ? t("nav.role.admin")
        : session.role === "RegisteredUser"
          ? t("nav.role.member")
          : null;

  return (
    <section
      className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(90,55,45,0.08)]"
      data-testid="profile-view"
    >
      <h1 className="text-2xl font-bold text-[var(--wesal-maroon)]">{t("profile.title")}</h1>
      <p className="mt-2 text-sm leading-7 text-[var(--wesal-muted)]">{t("profile.subtitle")}</p>

      <dl className="mt-6 space-y-4 text-sm">
        <div>
          <dt className="font-medium text-[var(--wesal-muted)]">{t("profile.name")}</dt>
          <dd className="mt-1 font-semibold text-[var(--wesal-text)]">{name}</dd>
        </div>
        {email ? (
          <div>
            <dt className="font-medium text-[var(--wesal-muted)]">{t("profile.email")}</dt>
            <dd className="mt-1 font-semibold text-[var(--wesal-text)]" dir="ltr">
              {email}
            </dd>
          </div>
        ) : null}
        {role ? (
          <div>
            <dt className="font-medium text-[var(--wesal-muted)]">{t("profile.role")}</dt>
            <dd className="mt-1 font-semibold text-[var(--wesal-text)]">{role}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/messages" className="btn-primary min-h-11">
          {t("nav.messages")}
        </Link>
        <button
          type="button"
          className="btn-outline min-h-11"
          disabled={isLoggingOut}
          aria-busy={isLoggingOut || undefined}
          onClick={() => {
            void logout();
          }}
        >
          {t("nav.logout")}
        </button>
      </div>
    </section>
  );
}
