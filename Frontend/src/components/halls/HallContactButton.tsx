"use client";

import { useState } from "react";
import Link from "next/link";
import HallUnavailableDialog from "@/components/halls/HallUnavailableDialog";
import { useHallPermissions } from "@/hooks/useHallPermissions";
import { useStartHallConversation } from "@/hooks/useStartHallConversation";
import { useT } from "@/i18n";
import { buildContactLoginRedirectPath } from "@/lib/auth-storage";

const CONTACT_BUTTON_CLASS =
  "btn-primary inline-flex w-full items-center justify-center gap-2 !min-h-11 !rounded-xl !px-3 !text-sm !font-bold sm:!min-h-12 sm:!text-[15px]";

type HallContactButtonProps = {
  hallId: string;
  isOwnHall?: boolean;
  isAvailable?: boolean;
  onOpened?: () => void;
};

export default function HallContactButton({
  hallId,
  isOwnHall = false,
  isAvailable = true,
  onOpened,
}: HallContactButtonProps) {
  const t = useT();
  const { authReady, isGuest, canContactOwner } = useHallPermissions({ isOwner: isOwnHall });
  const { start, starting, error, blocked, dismissBlocked } = useStartHallConversation();
  const [unavailableOpen, setUnavailableOpen] = useState(false);
  const loginHref = buildContactLoginRedirectPath(hallId);

  if (!authReady) {
    return (
      <div className="min-w-0 flex-1">
        <button type="button" className={CONTACT_BUTTON_CLASS} disabled>
          …
        </button>
      </div>
    );
  }

  if (isOwnHall || (!isGuest && !canContactOwner)) {
    return null;
  }

  if (!isAvailable) {
    return (
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className={`${CONTACT_BUTTON_CLASS} !opacity-50`}
          aria-disabled="true"
          data-testid="hall-contact-button"
          onClick={() => setUnavailableOpen(true)}
        >
          <ChatIcon />
          {t("halls.contact.cta")}
        </button>
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
    <div className="min-w-0 flex-1">
      {isGuest ? (
        <Link
          href={loginHref}
          className={CONTACT_BUTTON_CLASS}
          data-testid="hall-contact-button"
          aria-label={t("halls.contact.aria")}
        >
          <ChatIcon />
          {t("halls.contact.cta")}
        </Link>
      ) : (
        <button
          type="button"
          className={CONTACT_BUTTON_CLASS}
          data-testid="hall-contact-button"
          aria-label={t("halls.contact.aria")}
          disabled={starting}
          aria-busy={starting}
          onClick={() => {
            void start(hallId, { onOpened, loginHref });
          }}
        >
          <ChatIcon />
          {starting ? t("halls.contact.opening") : t("halls.contact.cta")}
        </button>
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
