"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import HallUnavailableDialog from "@/components/halls/HallUnavailableDialog";
import { useHallPermissions } from "@/hooks/useHallPermissions";
import { useProtectedHallError } from "@/hooks/useProtectedHallError";
import { useOptionalMessagesInbox } from "@/components/messages/MessagesInboxProvider";
import { useT } from "@/i18n";
import { isUnauthorizedApiError } from "@/lib/api-error";
import { isHallLockedApiError } from "@/lib/hall-locked-error";
import { isSystemLockedApiError } from "@/lib/system-locked-error";
import {
  conversationErrorMessage,
  createHallConversation,
} from "@/services/conversations";

const CONTACT_BUTTON_CLASS =
  "btn-outline flex w-full !min-h-11 !rounded-xl !px-2 !text-sm !font-bold sm:!min-h-12 sm:!text-[15px]";

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
  const router = useRouter();
  const { authReady, canContactOwner } = useHallPermissions({ isOwner: isOwnHall });
  const handleProtectedError = useProtectedHallError();
  const inbox = useOptionalMessagesInbox();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const inFlight = useRef(false);

  const loginHref = `/login?redirect=/halls/${hallId}&intent=contact`;

  async function startConversation() {
    if (!isAvailable || !canContactOwner || inFlight.current || submitting) {
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const thread = await createHallConversation(hallId);
      onOpened?.();
      if (inbox?.canUseMessaging) {
        inbox.openInbox(thread.conversationId);
        return;
      }
      router.push(`/messages/${thread.conversationId}`);
    } catch (err) {
      if (isHallLockedApiError(err) || isSystemLockedApiError(err)) {
        setBlockedOpen(true);
        setError(null);
        return;
      }
      const message = await handleProtectedError(err, conversationErrorMessage);
      if (isUnauthorizedApiError(err)) {
        router.push(loginHref);
        return;
      }
      setError(message);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  if (!authReady) {
    return (
      <div className="min-w-0 flex-1">
        <button type="button" className={CONTACT_BUTTON_CLASS} disabled>
          …
        </button>
      </div>
    );
  }

  if (!canContactOwner) {
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
          onClick={() => setBlockedOpen(true)}
        >
          {t("halls.contact.cta")}
        </button>
        <HallUnavailableDialog
          open={blockedOpen}
          title={t("halls.contact.blockedTitle")}
          body={t("halls.contact.blockedBody")}
          onClose={() => setBlockedOpen(false)}
          testId="hall-contact-blocked-dialog"
        />
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1">
      <button
        type="button"
        className={CONTACT_BUTTON_CLASS}
        disabled={submitting}
        data-testid="hall-contact-button"
        onClick={() => {
          void startConversation();
        }}
      >
        {submitting ? t("common.loading") : t("halls.contact.cta")}
      </button>
      {error ? (
        <p className="mt-2 text-start text-xs leading-5 text-[#a86267]" role="alert">
          {error}
        </p>
      ) : null}
      <HallUnavailableDialog
        open={blockedOpen}
        title={t("halls.contact.blockedTitle")}
        body={t("halls.contact.blockedBody")}
        onClose={() => setBlockedOpen(false)}
        testId="hall-contact-blocked-dialog"
      />
    </div>
  );
}
