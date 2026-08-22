"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import WesalLogo from "@/components/brand/WesalLogo";
import Reveal from "@/components/ui/Reveal";
import { useT } from "@/i18n";

const QUICK_LINKS = [
  { href: "/", labelKey: "nav.home" },
  { href: "/halls", labelKey: "nav.halls" },
  { href: "/about", labelKey: "nav.about" },
  { href: "/faq", labelKey: "nav.faq" },
] as const;

const ACCOUNT_LINKS = [
  { href: "/register", labelKey: "nav.register" },
  { href: "/login", labelKey: "nav.login" },
  { href: "/register?type=owner", labelKey: "footer.registerHall" },
] as const;

const SUPPORT_LINKS = [
  { href: "/faq", labelKey: "footer.helpCenter" },
  { href: "/about", labelKey: "footer.aboutWesal" },
  { href: "/halls", labelKey: "footer.browseHalls" },
] as const;

export default function Footer() {
  const t = useT();

  return (
    <footer className="wesal-footer relative isolate overflow-hidden border-t border-[var(--wesal-border)]">
      <div className="footer-marble" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/footer/dream-silk.webp?v=1"
          alt=""
          className="footer-marble-img"
          decoding="async"
        />
        <div className="footer-marble-wash" />
        <div className="footer-shine" />
        <span className="footer-twinkle footer-twinkle--1" />
        <span className="footer-twinkle footer-twinkle--2" />
        <span className="footer-twinkle footer-twinkle--3" />
        <span className="footer-twinkle footer-twinkle--4" />
      </div>

      <Reveal>
      <div className="container-wesal relative z-10 py-12 sm:py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <WesalLogo className="h-11 w-11" variant="brand" />
              <span className="text-xl font-extrabold text-[var(--wesal-maroon)]">
                {t("brand.name")}
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-8 text-[var(--wesal-muted)]">
              {t("brand.tagline")}
            </p>

            <div className="mt-5 flex items-center gap-2">
              <SocialLink href="https://www.facebook.com" label={t("footer.facebook")}>
                <FacebookIcon />
              </SocialLink>
              <SocialLink href="https://www.instagram.com" label={t("footer.instagram")}>
                <InstagramIcon />
              </SocialLink>
              <SocialLink href="https://wa.me/970599000000" label={t("footer.whatsapp")}>
                <WhatsAppIcon />
              </SocialLink>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-[var(--wesal-maroon)]">
              {t("footer.quickLinks")}
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-[var(--wesal-muted)]">
              {QUICK_LINKS.map((item) => (
                <li key={item.href + item.labelKey}>
                  <Link
                    href={item.href}
                    className="transition-colors hover:text-[var(--wesal-maroon)]"
                  >
                    {t(item.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-[var(--wesal-maroon)]">
              {t("footer.account")}
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-[var(--wesal-muted)]">
              {ACCOUNT_LINKS.map((item) => (
                <li key={item.href + item.labelKey}>
                  <Link
                    href={item.href}
                    className="transition-colors hover:text-[var(--wesal-maroon)]"
                  >
                    {t(item.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>

            <h3 className="mt-7 text-sm font-extrabold text-[var(--wesal-maroon)]">
              {t("footer.help")}
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-[var(--wesal-muted)]">
              {SUPPORT_LINKS.map((item) => (
                <li key={item.href + item.labelKey}>
                  <Link
                    href={item.href}
                    className="transition-colors hover:text-[var(--wesal-maroon)]"
                  >
                    {t(item.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-[var(--wesal-maroon)]">
              {t("footer.contact")}
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-[var(--wesal-muted)]">
              <li>
                <ContactRow icon={<PinIcon />}>
                  <span className="whitespace-pre-line">
                    {t("footer.location").replace(" / ", "\n")}
                  </span>
                </ContactRow>
              </li>
              <li>
                <a
                  href="mailto:info@wesal.ps"
                  className="transition-colors hover:text-[var(--wesal-maroon)]"
                >
                  <ContactRow icon={<MailIcon />}>
                    <span dir="ltr">info@wesal.ps</span>
                  </ContactRow>
                </a>
              </li>
              <li>
                <a
                  href="tel:+970599000000"
                  className="transition-colors hover:text-[var(--wesal-maroon)]"
                >
                  <ContactRow icon={<PhoneIcon />}>
                    <span dir="ltr">+970 599 000 000</span>
                  </ContactRow>
                </a>
              </li>
              <li>
                <ContactRow icon={<ClockIcon />}>
                  <span>{t("footer.hours")}</span>
                </ContactRow>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="relative z-10 border-t border-white/50 bg-white/80">
        <div className="container-wesal flex flex-col items-center justify-center gap-2 py-4 text-center text-xs text-[var(--wesal-muted)]">
          <p>
            © {new Date().getFullYear()} {t("brand.name")} — {t("footer.rights")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/about" className="transition-colors hover:text-[var(--wesal-maroon)]">
              {t("footer.privacy")}
            </Link>
            <Link href="/faq" className="transition-colors hover:text-[var(--wesal-maroon)]">
              {t("footer.terms")}
            </Link>
          </div>
        </div>
      </div>
      </Reveal>
    </footer>
  );
}

function ContactRow({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-[var(--wesal-maroon)]">
        {icon}
      </span>
      <span className="min-w-0 leading-6">{children}</span>
    </span>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--wesal-border)] bg-[var(--wesal-footer)] text-[var(--wesal-maroon)] transition-colors hover:border-[var(--wesal-maroon)] hover:bg-[var(--wesal-maroon)] hover:text-white"
    >
      {children}
    </a>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H7v3h3v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3.2A8.7 8.7 0 0 0 4.4 16.3L3.5 20.5l4.3-.9A8.7 8.7 0 1 0 12 3.2Zm4.7 12.3c-.2.5-1 .9-1.6 1-.4.1-.9.1-1.5-.1-1.4-.5-2.8-1.4-3.9-2.6-1-1.1-1.8-2.5-2.1-3.2-.2-.5 0-1 .3-1.3l.7-.8c.2-.2.4-.3.7-.3.1 0 .3 0 .4.2l1 1.7c.1.2.1.4 0 .6l-.3.5c-.1.2-.1.3 0 .5.4.7 1.1 1.5 1.9 2.1.7.6 1.4 1 2.1 1.2.2.1.4 0 .5-.1l.5-.5c.2-.2.4-.2.6-.1l1.7.9c.3.1.4.4.3.7l-.3.9Z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21s6.5-5.4 6.5-10.2A6.5 6.5 0 1 0 5.5 10.8C5.5 15.6 12 21 12 21Z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="10.5" r="2.1" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 7.5 12 12.5l7.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 4.5h2.2l1 3.2-1.5 1a10.5 10.5 0 0 0 5.6 5.6l1-1.5 3.2 1V17a2 2 0 0 1-2.2 2A13.5 13.5 0 0 1 4.5 7.7 2 2 0 0 1 6.5 5.5H8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8v4.5l3 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
