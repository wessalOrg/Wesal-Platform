"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import WesalLogo from "@/components/brand/WesalLogo";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";

const navLinks = [
  { href: "/", label: "الرئيسية" },
  { href: "/halls", label: "القاعات" },
  { href: "/about", label: "من نحن" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="wesal-navbar sticky top-0 z-50">
      <div className="wesal-navbar-bg" aria-hidden="true" />
      <div className="container-wesal relative z-10">
        <div className="flex h-14 items-center justify-between gap-3 sm:h-16">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="relative h-10 w-10 sm:h-11 sm:w-11">
              <WesalLogo className="h-full w-full" variant="brand" />
            </span>
            <span className="text-xl font-bold text-[var(--wesal-maroon)] sm:text-2xl">
              وصال
            </span>
          </Link>

          <nav
            className="hidden items-center gap-1 text-sm font-medium text-[var(--wesal-text)] md:flex"
            aria-label="التنقل الرئيسي"
          >
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-3 py-1.5 transition ${
                    active
                      ? "text-[var(--wesal-maroon)] underline decoration-[var(--wesal-maroon)] decoration-2 underline-offset-8"
                      : "hover:text-[var(--wesal-maroon)]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2.5 md:flex lg:gap-3">
            <LanguageSwitcher />
            <Link href="/login" className="btn-outline">
              تسجيل الدخول
            </Link>
            <Link href="/register" className="btn-primary">
              إنشاء حساب
            </Link>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--wesal-border)] text-[var(--wesal-maroon)] md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="sr-only">القائمة</span>
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {open ? (
        <div
          id="mobile-nav"
          className="wesal-navbar-mobile border-t border-[var(--wesal-border)]/60 px-5 py-4 md:hidden"
        >
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="py-2 text-sm font-medium text-[var(--wesal-text)]"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <LanguageSwitcher compact />
            <Link
              href="/login"
              className="btn-outline w-full"
              onClick={() => setOpen(false)}
            >
              تسجيل الدخول
            </Link>
            <Link
              href="/register"
              className="btn-primary w-full"
              onClick={() => setOpen(false)}
            >
              إنشاء حساب
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
