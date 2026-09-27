"use client";

import { useContactAdmin } from "@/hooks/useContactAdmin";
import { useT } from "@/i18n";

type ContactAdminButtonProps = {
  variant?: "sidebar" | "header";
  onOpened?: () => void;
};

export default function ContactAdminButton({
  variant = "sidebar",
  onOpened,
}: ContactAdminButtonProps) {
  const t = useT();
  const { open, busy, errorKey, unread } = useContactAdmin();
  const label = busy ? t("owner.contactAdmin.opening") : t("owner.nav.contactAdmin");

  if (variant === "header") {
    return (
      <div className="relative">
        <button
          type="button"
          className="seeker-dash-notify"
          disabled={busy}
          aria-busy={busy}
          aria-label={label}
          data-testid="owner-contact-admin-header"
          onClick={() => {
            void open().then((target) => {
              if (target) onOpened?.();
            });
          }}
        >
          <span className="seeker-dash-notify-bell" aria-hidden="true">
            <HeadsetIcon />
          </span>
          {unread ? <span className="seeker-notify-dot" aria-hidden="true" /> : null}
        </button>
        {errorKey ? (
          <p className="sr-only" role="alert">
            {t(errorKey)}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        className="seeker-dash-sidebar-link w-full"
        disabled={busy}
        aria-busy={busy}
        data-testid="owner-contact-admin-nav"
        onClick={() => {
          void open().then((target) => {
            if (target) onOpened?.();
          });
        }}
      >
        <span className="seeker-dash-sidebar-icon" aria-hidden="true">
          <HeadsetIcon />
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
      </button>
      {errorKey ? (
        <p className="mt-1 px-3 text-xs leading-5 text-[#a86267]" role="alert">
          {t(errorKey)}
        </p>
      ) : null}
    </div>
  );
}

function HeadsetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[1.15rem] w-[1.15rem]" aria-hidden="true">
      <path
        d="M4.5 12a7.5 7.5 0 0 1 15 0v5.2A2.3 2.3 0 0 1 17.2 19.5h-1.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M4.5 13.5v3A1.8 1.8 0 0 0 6.3 18.3h.4A1.8 1.8 0 0 0 8.5 16.5v-2A1.8 1.8 0 0 0 6.7 12.7h-.4A1.8 1.8 0 0 0 4.5 14.5v-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M19.5 13.5v3A1.8 1.8 0 0 1 17.7 18.3h-.4A1.8 1.8 0 0 1 15.5 16.5v-2A1.8 1.8 0 0 1 17.3 12.7h.4A1.8 1.8 0 0 1 19.5 14.5v-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
