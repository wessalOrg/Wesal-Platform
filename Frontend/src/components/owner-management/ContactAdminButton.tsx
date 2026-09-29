"use client";

import Link from "next/link";
import { Suspense, type MouseEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useContactAdmin } from "@/hooks/useContactAdmin";
import { useT } from "@/i18n";

type ContactAdminButtonProps = {
  variant?: "sidebar" | "header";
  onOpened?: () => void;
};

export default function ContactAdminButton(props: ContactAdminButtonProps) {
  return (
    <Suspense fallback={<ContactAdminButtonFace {...props} active={false} href="/owner/messages?contact=admin" unread={false} />}>
      <ContactAdminButtonReady {...props} />
    </Suspense>
  );
}

function ContactAdminButtonReady(props: ContactAdminButtonProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { href, unread } = useContactAdmin();
  const active =
    pathname.startsWith("/owner/messages") && searchParams.get("contact") === "admin";

  return (
    <ContactAdminButtonFace
      {...props}
      href={href}
      unread={unread}
      active={active}
      onClick={() => {
        props.onOpened?.();
      }}
    />
  );
}

function ContactAdminButtonFace({
  variant = "sidebar",
  href,
  unread,
  active,
  onClick,
}: ContactAdminButtonProps & {
  href: string;
  unread: boolean;
  active: boolean;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const t = useT();
  const router = useRouter();
  const label = t("owner.nav.contactAdmin");

  if (variant === "header") {
    return (
      <div className="relative">
        <Link
          href={href}
          prefetch
          className="seeker-dash-notify"
          aria-label={label}
          aria-current={active ? "page" : undefined}
          data-testid="owner-contact-admin-header"
          onClick={onClick}
          onMouseEnter={() => router.prefetch(href)}
          onFocus={() => router.prefetch(href)}
        >
          <span className="seeker-dash-notify-bell" aria-hidden="true">
            <ContactAdminIcon />
          </span>
          {unread ? <span className="seeker-notify-dot" aria-hidden="true" /> : null}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        href={href}
        prefetch
        className={`seeker-dash-sidebar-link w-full${
          active ? " seeker-dash-sidebar-link--active" : ""
        }`}
        aria-current={active ? "page" : undefined}
        data-testid="owner-contact-admin-nav"
        onClick={onClick}
        onMouseEnter={() => router.prefetch(href)}
        onFocus={() => router.prefetch(href)}
      >
        <span className="seeker-dash-sidebar-icon" aria-hidden="true">
          <ContactAdminIcon />
        </span>
        <span>
          {label}
          {unread ? (
            <span
              className="ms-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-[#c45b55]"
              aria-hidden="true"
            />
          ) : null}
        </span>
      </Link>
    </div>
  );
}

function ContactAdminIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[1.15rem] w-[1.15rem]" aria-hidden="true">
      <circle cx="6.2" cy="8" r="2.45" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M2.55 17.6c.4-2.55 1.8-4 3.65-4s3.25 1.45 3.65 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="17.8" cy="8" r="2.45" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M14.15 17.6c.4-2.55 1.8-4 3.65-4s3.25 1.45 3.65 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M9.55 6.35h1.9M9.75 8.45h1.35"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
      <path
        d="M14.45 6.35h-1.9M14.25 8.45h-1.35"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
    </svg>
  );
}
