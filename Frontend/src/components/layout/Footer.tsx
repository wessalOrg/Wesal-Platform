"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import WesalLogo from "@/components/brand/WesalLogo";
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
      </div>

      <div className="container-wesal relative z-10 py-7 sm:py-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2">
              <WesalLogo className="h-8 w-8" variant="brand" />
              <span className="text-lg font-extrabold text-[var(--wesal-maroon)]">
                {t("brand.name")}
              </span>
            </div>
            <p className="mt-2.5 max-w-xs text-xs leading-6 text-[var(--wesal-muted)] sm:text-sm sm:leading-7">
              {t("brand.tagline")}
            </p>

            <div className="mt-3.5 flex items-center gap-1.5">
              <SocialLink href="https://www.facebook.com" label={t("footer.facebook")}>
                <FacebookIcon />
              </SocialLink>
              <SocialLink href="https://www.instagram.com" label={t("footer.instagram")}>
                <InstagramIcon />
              </SocialLink>
              <SocialLink href="https://wa.me/970595988398" label={t("footer.whatsapp")}>
                <WhatsAppIcon />
              </SocialLink>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-extrabold text-[var(--wesal-maroon)] sm:text-sm">
              {t("footer.quickLinks")}
            </h3>
            <ul className="mt-2.5 space-y-1.5 text-xs text-[var(--wesal-muted)] sm:text-sm">
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
            <h3 className="text-xs font-extrabold text-[var(--wesal-maroon)] sm:text-sm">
              {t("footer.account")}
            </h3>
            <ul className="mt-2.5 space-y-1.5 text-xs text-[var(--wesal-muted)] sm:text-sm">
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

            <h3 className="mt-4 text-xs font-extrabold text-[var(--wesal-maroon)] sm:text-sm">
              {t("footer.help")}
            </h3>
            <ul className="mt-2.5 space-y-1.5 text-xs text-[var(--wesal-muted)] sm:text-sm">
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
            <h3 className="text-xs font-extrabold text-[var(--wesal-maroon)] sm:text-sm">
              {t("footer.contact")}
            </h3>
            <ul className="mt-2.5 space-y-2 text-xs text-[var(--wesal-muted)] sm:text-sm">
              <li>
                <ContactRow icon={<PinIcon />}>
                  <span className="whitespace-pre-line">
                    {t("footer.location").replace(" / ", "\n")}
                  </span>
                </ContactRow>
              </li>
              <li>
                <a
                  href="mailto:wesalplatform.gaza@gmail.com"
                  className="transition-colors hover:text-[var(--wesal-maroon)]"
                >
                  <ContactRow icon={<MailIcon />}>
                    <span dir="ltr">wesalplatform.gaza@gmail.com</span>
                  </ContactRow>
                </a>
              </li>
              <li>
                <a
                  href="tel:0595988398"
                  className="transition-colors hover:text-[var(--wesal-maroon)]"
                >
                  <ContactRow icon={<PhoneIcon />}>
                    <span dir="ltr">0595988398</span>
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

      <div className="container-wesal relative z-10 pb-3.5 pt-1">
        <div className="mb-2 h-px w-full bg-[#e6d5c8]" />
        <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--wesal-muted)] sm:text-xs">
          <p>
            © {new Date().getFullYear()} {t("brand.name")} — {t("footer.rights")}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span>{t("footer.privacy")}</span>
            <span>{t("footer.terms")}</span>
          </div>
        </div>
      </div>
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
    <span className="flex items-start gap-2">
      <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[var(--wesal-maroon)]">
        {icon}
      </span>
      <span className="min-w-0 leading-5">{children}</span>
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
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--wesal-border)] bg-[var(--wesal-footer)] text-[var(--wesal-maroon)] transition-colors hover:border-[var(--wesal-maroon)] hover:bg-[var(--wesal-maroon)] hover:text-white"
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
