"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import WesalBrandLockup from "@/components/brand/WesalBrandLockup";
import AccountNotificationsPanel from "@/components/layout/AccountNotificationsPanel";
import AuthAccountMenu from "@/components/layout/AuthAccountMenu";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import NavbarMessagesButton from "@/components/layout/NavbarMessagesButton";
import NavbarNotificationsButton from "@/components/layout/NavbarNotificationsButton";
import PwaInstallButton from "@/components/pwa/PwaInstallButton";
import { useDismissibleOverlay } from "@/hooks/useDismissibleOverlay";
import { useTranslateLang } from "@/i18n";
import { getAccountProfilePath } from "@/lib/account-profile-path";
import { markAuthNavigation } from "@/lib/auth-nav";

const NAV_HREFS = [
  { href: "/", key: "nav.home" },
  { href: "/halls", key: "nav.halls" },
  { href: "/event-planners", key: "nav.eventPlanners" },
  { href: "/photographers", key: "nav.photographers" },
  { href: "/about", key: "nav.about" },
] as const;

function navPath(href: string) {
  return href.split("#")[0] || "/";
}

function navHash(href: string) {
  const index = href.indexOf("#");
  return index >= 0 ? href.slice(index) : "";
}

function isNavActive(pathname: string, hash: string, href: string) {
  const path = navPath(href);
  const targetHash = navHash(href);
  if (targetHash) {
    return pathname === path && hash === targetHash;
  }
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function Navbar({
  variant = "default",
}: {
  variant?: "default" | "overlay";
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const notify = useDismissibleOverlay();
  const [hash, setHash] = useState("");
  const [menuPath, setMenuPath] = useState(pathname);
  const router = useRouter();
  const { t } = useTranslateLang();
  const { session, status, logout, isLoggingOut } = useAuth();
  const authenticated = session.isAuthenticated;
  const overlay = variant === "overlay";

  if (menuPath !== pathname) {
    setMenuPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    const id = window.location.hash.replace(/^#/, "");
    if (id) {
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  useEffect(() => {
    if (authenticated) return;
    router.prefetch("/login");
    router.prefetch("/register");
  }, [authenticated, router]);

  useEffect(() => {
    if (!authenticated) return;
    router.prefetch(getAccountProfilePath(session.role));
    router.prefetch("/messages");
    router.prefetch("/notifications");
  }, [authenticated, router, session.role]);

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
          <WesalBrandLockup />

          <nav
            className="hidden min-w-0 flex-1 items-center justify-center gap-0 text-[12.5px] font-medium text-[var(--wesal-text)] lg:flex xl:gap-0.5 xl:text-sm"
            aria-label={t("nav.main")}
          >
            {NAV_HREFS.map((link) => {
              const active = isNavActive(pathname, hash, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center whitespace-nowrap rounded-full px-1.5 py-1.5 transition xl:px-2.5 ${
                    active
                      ? "text-[var(--wesal-maroon)] underline decoration-[var(--wesal-maroon)] decoration-2 underline-offset-8"
                      : "hover:text-[var(--wesal-maroon)]"
                  }`}
                  onClick={() => setHash(navHash(link.href))}
                >
                  {t(link.key)}
                </Link>
              );
            })}
          </nav>

          <div className="flex min-w-0 items-center gap-1 sm:gap-2 lg:gap-3">
            <PwaInstallButton />
            <div ref={notify.rootRef} className="hidden shrink-0 items-center gap-1.5 sm:gap-2 lg:flex">
              <LanguageSwitcher />
              {authenticated ? (
                <NavbarNotificationsButton
                  open={notify.open}
                  panelId={notify.panelId}
                  onToggle={notify.toggle}
                  onClose={notify.close}
                />
              ) : null}
              {authenticated ? <NavbarMessagesButton /> : null}
            </div>
            {status === "loading" ? (
              <span className="h-10 w-28 shrink-0 animate-pulse rounded-xl bg-[var(--wesal-pink)] sm:w-40" />
            ) : authenticated ? (
              <AuthAccountMenu
                loggingOut={isLoggingOut}
                onLogout={() => void logout()}
              />
            ) : (
              <div className="hidden min-w-0 items-center gap-2 lg:flex lg:gap-3">
                <GuestActions
                  login={t("nav.login")}
                  register={t("nav.register")}
                />
              </div>
            )}

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
        <div className="wesal-navbar-mobile-layer lg:hidden" role="presentation">
          <button
            type="button"
            className="wesal-navbar-mobile-backdrop"
            aria-label={t("common.close")}
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-nav"
            className={`wesal-navbar-mobile wesal-navbar-mobile--drawer flex flex-col overflow-y-auto px-5 py-4 ${
              overlay ? "wesal-navbar-mobile--overlay" : ""
            }`}
          >
            <div className="wesal-navbar-mobile-ink" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/hero/dream-ink.webp" alt="" className="wesal-navbar-mobile-ink-img" decoding="async" />
            </div>
            <div className="wesal-navbar-mobile-head relative z-10 mb-5 flex items-center gap-2">
              <p className="wesal-navbar-mobile-title min-w-0 flex-1 font-extrabold text-[var(--wesal-maroon)]">
                {t("nav.menu")}
              </p>
              <LanguageSwitcher compact className="wesal-navbar-mobile-lang" />
              <button
                type="button"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--wesal-border)] text-base text-[var(--wesal-maroon)]"
                aria-label={t("common.close")}
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
            {authenticated && status !== "loading" ? (
              <p className="wesal-navbar-mobile-hello relative z-10 mb-3 text-center text-base font-bold text-[var(--wesal-maroon)]">
                {t("nav.hello")}{" "}
                {session.userName?.trim() || t("nav.account")}
              </p>
            ) : null}
            {authenticated ? (
              <div className="relative z-10 mb-3 flex flex-wrap items-center justify-center gap-2">
                <NavbarMessagesButton onNavigate={() => setOpen(false)} />
                <NavbarNotificationsButton
                  open={notify.open}
                  panelId={notify.panelId}
                  showPanel={false}
                  onToggle={() => {
                    setOpen(false);
                    notify.setOpen(true);
                  }}
                  onClose={notify.close}
                />
              </div>
            ) : null}
            <nav className="wesal-navbar-mobile-links relative z-10 flex flex-col items-center gap-1" aria-label={t("nav.main")}>
              {NAV_HREFS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex min-h-11 w-full items-center justify-center py-2.5 text-center text-sm font-medium text-[var(--wesal-text)]"
                  onClick={() => {
                    setHash(navHash(link.href));
                    setOpen(false);
                  }}
                >
                  {t(link.key)}
                </Link>
              ))}
            </nav>
            <div className="relative z-10 mt-auto flex flex-col gap-2.5 pt-8 pb-16">
              <PwaInstallButton variant="full" />
              {status === "loading" ? (
                <div
                  className="h-11 w-full animate-pulse rounded-xl bg-[var(--wesal-pink)]"
                  aria-hidden="true"
                />
              ) : authenticated ? (
                <AuthAccountMenu
                  stacked
                  loggingOut={isLoggingOut}
                  onLogout={() => void logout()}
                  onNavigate={() => setOpen(false)}
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
        </div>
      ) : null}
      <BodyPortal>
        <div className="lg:hidden">
          <AccountNotificationsPanel
            open={notify.open}
            onClose={notify.close}
            panelId={notify.panelId}
          />
        </div>
      </BodyPortal>
    </header>
  );
}

function BodyPortal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTarget(document.body);
  }, []);
  if (!target) return null;
  return createPortal(children, target);
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
        className={`btn-outline whitespace-nowrap ${stacked ? "min-h-[3.15rem] w-full text-base" : "min-h-11 shrink-0 px-3 text-xs lg:px-[1.15rem] lg:text-sm"}`}
        onClick={goAuth}
      >
        {login}
      </Link>
      <Link
        href="/register"
        prefetch
        className={`btn-primary whitespace-nowrap ${stacked ? "min-h-[3.15rem] w-full text-base" : "min-h-11 shrink-0 px-3 text-xs lg:px-[1.15rem] lg:text-sm"}`}
        onClick={goAuth}
      >
        {register}
      </Link>
    </>
  );
}
