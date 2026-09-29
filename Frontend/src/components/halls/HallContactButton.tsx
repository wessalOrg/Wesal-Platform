"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import HallUnavailableDialog from "@/components/halls/HallUnavailableDialog";
import { useHallPermissions } from "@/hooks/useHallPermissions";
import { useStartHallConversation } from "@/hooks/useStartHallConversation";
import { useT } from "@/i18n";
import { buildContactLoginRedirectPath } from "@/lib/auth-storage";

const CONTACT_BAR_CLASS =
  "btn-primary inline-flex w-full items-center justify-center gap-2 !min-h-11 !rounded-xl !px-3 !text-sm !font-bold sm:!min-h-12 sm:!text-[15px]";

const CONTACT_PAGE_CLASS =
  "btn-primary min-h-11 h-full w-full gap-2 whitespace-nowrap";

type HallContactButtonProps = {
  hallId: string;
  isOwnHall?: boolean;
  isAvailable?: boolean;
  onOpened?: () => void;
  variant?: "bar" | "bubble";
};

export default function HallContactButton({
  hallId,
  isOwnHall = false,
  isAvailable = true,
  onOpened,
  variant = "bar",
}: HallContactButtonProps) {
  const t = useT();
  const { authReady, isGuest, canContactOwner } = useHallPermissions({ isOwner: isOwnHall });
  const { start, starting, error, blocked, dismissBlocked } = useStartHallConversation();
  const [unavailableOpen, setUnavailableOpen] = useState(false);
  const loginHref = buildContactLoginRedirectPath(hallId);
  const bubble = variant === "bubble";
  const label = starting ? t("halls.contact.opening") : t("halls.contact.cta");
  const wrapClass = bubble ? "relative min-w-0 h-full w-full" : "min-w-0 flex-1";

  if (!authReady) {
    return (
      <div className={wrapClass}>
        <ContactFace variant={variant} className={bubble ? undefined : CONTACT_BAR_CLASS} disabled>
          …
        </ContactFace>
      </div>
    );
  }

  if (isOwnHall || (!isGuest && !canContactOwner)) {
    return null;
  }

  if (!isAvailable) {
    return (
      <div className={wrapClass}>
        <ContactFace
          variant={variant}
          className={bubble ? undefined : `${CONTACT_BAR_CLASS} !opacity-50`}
          ariaDisabled
          testId
          onClick={() => setUnavailableOpen(true)}
        >
          {t("halls.contact.cta")}
        </ContactFace>
        <HallUnavailableDialog
          open={unavailableOpen}
          title={t("halls.contact.blockedTitle")}
          body={t("halls.contact.blockedBody")}
          onClose={() => setUnavailableOpen(false)}
          testId="hall-contact-blocked-dialog"
        />
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      {isGuest ? (
        <ContactFace
          variant={variant}
          href={loginHref}
          className={bubble ? undefined : CONTACT_BAR_CLASS}
          ariaLabel={t("halls.contact.aria")}
          testId
        >
          {t("halls.contact.cta")}
        </ContactFace>
      ) : (
        <ContactFace
          variant={variant}
          className={bubble ? undefined : CONTACT_BAR_CLASS}
          ariaLabel={t("halls.contact.aria")}
          testId
          disabled={starting}
          busy={starting}
          onClick={() => {
            void start(hallId, { onOpened, loginHref });
          }}
        >
          {label}
        </ContactFace>
      )}
      {error ? (
        <p className="mt-2 text-start text-xs leading-5 text-[#a86267]" role="alert">
          {error}
        </p>
      ) : null}
      <HallUnavailableDialog
        open={blocked}
        title={t("halls.contact.blockedTitle")}
        body={t("halls.contact.blockedBody")}
        onClose={dismissBlocked}
        testId="hall-contact-blocked-dialog"
      />
    </div>
  );
}

function ContactFace({
  variant,
  className,
  children,
  href,
  disabled,
  ariaDisabled,
  busy,
  ariaLabel,
  testId,
  onClick,
}: {
  variant: "bar" | "bubble";
  className?: string;
  children: ReactNode;
  href?: string;
  disabled?: boolean;
  ariaDisabled?: boolean;
  busy?: boolean;
  ariaLabel?: string;
  testId?: boolean;
  onClick?: () => void;
}) {
  const bubble = variant === "bubble";
  const classes = bubble ? CONTACT_PAGE_CLASS : className;
  const inner = (
    <>
      <ChatIcon />
      {children}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        data-testid={testId ? "hall-contact-button" : undefined}
        aria-label={ariaLabel}
        onClick={onClick}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      data-testid={testId ? "hall-contact-button" : undefined}
      aria-label={ariaLabel}
      disabled={disabled}
      aria-disabled={ariaDisabled || undefined}
      aria-busy={busy || undefined}
      onClick={onClick}
    >
      {inner}
    </button>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H10l-4.2 3.2A.7.7 0 0 1 5 18.6V6.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
