"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import WesalLogo from "@/components/brand/WesalLogo";
import AuthNavIcons from "@/components/layout/AuthNavIcons";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import { useTranslateLang } from "@/i18n";
import { markAuthNavigation } from "@/lib/auth-nav";

const NAV_HREFS = [
  { href: "/", key: "nav.home" },
  { href: "/halls", key: "nav.halls" },
  { href: "/about", key: "nav.about" },
] as const;

export default function Navbar({
  variant = "default",
}: {
  variant?: "default" | "overlay";
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  const router = useRouter();
  const { lang, t } = useTranslateLang();
  const { session, status, logout, isLoggingOut } = useAuth();
  const authenticated = session.isAuthenticated;
  const displayName = session.userName?.trim() || t("nav.account");
  const separator = lang === "en" ? "," : "،";
  const overlay = variant === "overlay";
  const profileLabel = t("nav.profile");
  const messagesLabel = t("nav.messages");

  if (menuPath !== pathname) {
    setMenuPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (authenticated) return;
    router.prefetch("/login");
    router.prefetch("/register");
  }, [authenticated, router]);

  useEffect(() => {
    if (!authenticated) return;
    router.prefetch("/profile");
    router.prefetch("/messages");
  }, [authenticated, router]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onResize = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`wesal-navbar ${overlay ? "wesal-navbar--overlay" : "sticky top-0"} z-50`}
      data-variant={variant}
    >
      <div className="wesal-navbar-bg" aria-hidden="true" />
      <div className="container-wesal relative z-10">
        <div className="flex h-14 min-w-0 items-center justify-between gap-2 sm:h-16 sm:gap-3">
          <Link
            href="/"
            className="flex min-w-0 shrink-0 items-center gap-2"
            aria-label={t("brand.name")}
          >
            <span className="relative h-10 w-10 shrink-0 sm:h-11 sm:w-11">
              <WesalLogo className="h-full w-full" variant="brand" />
            </span>
            <span className="truncate text-xl font-bold text-[var(--wesal-maroon)] sm:text-2xl">
              {t("brand.name")}
            </span>
          </Link>

          <nav
            className="hidden min-w-0 items-center gap-0.5 text-sm font-medium text-[var(--wesal-text)] md:flex"
            aria-label={t("nav.main")}
          >
            {NAV_HREFS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap rounded-full px-2.5 py-1.5 transition lg:px-3 ${
                    active
                      ? "text-[var(--wesal-maroon)] underline decoration-[var(--wesal-maroon)] decoration-2 underline-offset-8"
                      : "hover:text-[var(--wesal-maroon)]"
                  }`}
                >
                  {t(link.key)}
                </Link>
              );
            })}
          </nav>

          <div className="flex min-w-0 items-center gap-1 sm:gap-2 lg:gap-3">
            <div className="hidden min-w-0 items-center gap-2 lg:flex lg:gap-3">
              <LanguageSwitcher />
              {status === "loading" ? (
                <span className="h-11 w-40 shrink-0 animate-pulse rounded-xl bg-[var(--wesal-pink)]" />
              ) : authenticated ? (
                <AuthAccount
                  hello={t("nav.hello")}
                  name={displayName}
                  logoutLabel={t("nav.logout")}
                  separator={separator}
                  loggingOut={isLoggingOut}
                  onLogout={() => void logout()}
                />
              ) : (
                <GuestActions
                  login={t("nav.login")}
                  register={t("nav.register")}
                />
              )}
            </div>

            {/* Far-left (visual) cluster in RTL: icons sit at the outer edge with the menu */}
            {status === "ready" && authenticated ? (
              <AuthNavIcons
                profileLabel={profileLabel}
                messagesLabel={messagesLabel}
              />
            ) : null}

            <button
              type="button"
              className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--wesal-border)] text-[var(--wesal-maroon)] lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={t("nav.menu")}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? "✕" : "☰"}
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <div
          id="mobile-nav"
          className={`wesal-navbar-mobile max-h-[min(32rem,calc(100svh-3.5rem))] overflow-y-auto border-t border-[var(--wesal-border)]/60 px-5 py-4 lg:hidden ${
            overlay ? "wesal-navbar-mobile--overlay" : ""
          }`}
        >
          <div className="flex flex-col gap-3">
            {NAV_HREFS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex min-h-11 items-center py-2 text-sm font-medium text-[var(--wesal-text)]"
                onClick={() => setOpen(false)}
              >
                {t(link.key)}
              </Link>
            ))}
            {status === "ready" && authenticated ? (
              <AuthNavIcons
                profileLabel={profileLabel}
                messagesLabel={messagesLabel}
                stacked
                onNavigate={() => setOpen(false)}
              />
            ) : null}
            <LanguageSwitcher compact />
            {status === "loading" ? (
              <div
                className="h-11 w-full animate-pulse rounded-xl bg-[var(--wesal-pink)]"
                aria-hidden="true"
              />
            ) : authenticated ? (
              <AuthAccount
                hello={t("nav.hello")}
                name={displayName}
                logoutLabel={t("nav.logout")}
                separator={separator}
                stacked
                loggingOut={isLoggingOut}
                onLogout={() => {
                  setOpen(false);
                  void logout();
                }}
              />
            ) : (
              <GuestActions
                login={t("nav.login")}
                register={t("nav.register")}
                stacked
                onNavigate={() => setOpen(false)}
              />
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}

function GuestActions({
  login,
  register,
  stacked = false,
  onNavigate,
}: {
  login: string;
  register: string;
  stacked?: boolean;
  onNavigate?: () => void;
}) {
  const goAuth = () => {
    markAuthNavigation();
    onNavigate?.();
  };

  return (
    <>
      <Link
        href="/login"
        prefetch
        className={`btn-outline min-h-11 whitespace-nowrap ${stacked ? "w-full" : "shrink-0 px-3 text-xs lg:px-[1.15rem] lg:text-sm"}`}
        onClick={goAuth}
      >
        {login}
      </Link>
      <Link
        href="/register"
        prefetch
        className={`btn-primary min-h-11 whitespace-nowrap ${stacked ? "w-full" : "shrink-0 px-3 text-xs lg:px-[1.15rem] lg:text-sm"}`}
        onClick={goAuth}
      >
        {register}
      </Link>
    </>
  );
}

function AuthAccount({
  hello,
  name,
  logoutLabel,
  separator,
  stacked = false,
  loggingOut = false,
  onLogout,
}: {
  hello: string;
  name: string;
  logoutLabel: string;
  separator: string;
  stacked?: boolean;
  loggingOut?: boolean;
  onLogout: () => void;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2.5 ${stacked ? "w-full flex-col" : ""}`}
      data-testid="navbar-authenticated"
    >
      <p
        className={`min-w-0 text-sm font-semibold text-[var(--wesal-maroon)] ${
          stacked ? "w-full text-start" : "max-w-[8.5rem] truncate lg:max-w-[10rem]"
        }`}
      >
        {hello}
        {separator} {name}
      </p>
      <button
        type="button"
        className={`btn-outline min-h-11 whitespace-nowrap ${stacked ? "w-full" : "shrink-0 px-3 text-xs lg:px-[1.15rem] lg:text-sm"}`}
        disabled={loggingOut}
        aria-busy={loggingOut || undefined}
        onClick={onLogout}
      >
        {logoutLabel}
      </button>
    </div>
  );
}
