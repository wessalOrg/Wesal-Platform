"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useHallPermissions } from "@/hooks/useHallPermissions";
import { useProtectedHallError } from "@/hooks/useProtectedHallError";
import { useT } from "@/i18n";
import { isUnauthorizedApiError } from "@/lib/api-error";
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const loginHref = `/login?redirect=/halls/${hallId}&intent=contact`;

  async function startConversation() {
    if (!isAvailable || !canContactOwner || inFlight.current || submitting) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const thread = await createHallConversation(hallId);
      onOpened?.();
      router.push(`/messages/${thread.conversationId}`);
    } catch (err) {
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
        <button type="button" className={CONTACT_BUTTON_CLASS} disabled data-testid="hall-contact-button">
          {t("halls.contact.cta")}
        </button>
        <p className="mt-2 text-start text-xs leading-5 text-[#a86267]" data-testid="hall-contact-unavailable" role="status">
          {t("halls.contact.unavailable")}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1">
      <button
        type="button"
        className={CONTACT_BUTTON_CLASS}
        data-testid="hall-contact-button"
        aria-label={t("halls.contact.aria")}
        disabled={submitting}
        aria-busy={submitting}
        onClick={() => void startConversation()}
      >
        {submitting ? t("halls.contact.opening") : t("halls.contact.cta")}
      </button>
      {error ? (
        <p className="mt-2 text-start text-xs leading-5 text-[#a86267]" data-testid="hall-contact-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
