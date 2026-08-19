"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  conversationErrorMessage,
  createHallConversation,
} from "@/services/conversations";
import { ApiError } from "@/lib/api-error";

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
  const router = useRouter();
  const { session, status: authStatus } = useAuth();
  const authReady = authStatus === "ready";
  const role = (session.role ?? "").toLowerCase();
  const isGuest = authReady && !session.isAuthenticated;
  const isHallOwner = role === "hallowner";
  const canStartConversation =
    session.isAuthenticated && (role === "registereduser" || isHallOwner || role === "admin");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const loginHref = `/login?redirect=/halls/${hallId}&intent=contact`;
  const registerHref = `/register?redirect=/halls/${hallId}&intent=contact`;

  if (isOwnHall) {
    return null;
  }

  async function startConversation() {
    if (!isAvailable || inFlight.current || submitting) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const thread = await createHallConversation(hallId);
      onOpened?.();
      router.push(`/messages/${thread.conversationId}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push(loginHref);
        return;
      }
      setError(conversationErrorMessage(err));
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

  if (isGuest) {
    return (
      <div className="min-w-0 flex-1" dir="rtl">
        <Link
          href={loginHref}
          className={CONTACT_BUTTON_CLASS}
          data-testid="hall-contact-button"
          aria-label="تواصل مع صاحب القاعة"
        >
          تواصل معنا
        </Link>
        <p className="mt-2 text-start text-[11px] leading-5 text-[var(--wesal-muted)]">
          للتواصل سجّلي الدخول أو{" "}
          <Link href={registerHref} className="font-bold text-[var(--wesal-maroon)] underline underline-offset-4">
            أنشئي حساباً
          </Link>
        </p>
      </div>
    );
  }

  if (!isAvailable) {
    return (
      <div className="min-w-0 flex-1" dir="rtl">
        <button type="button" className={CONTACT_BUTTON_CLASS} disabled data-testid="hall-contact-button">
          تواصل معنا
        </button>
        <p className="mt-2 text-start text-xs leading-5 text-[#a86267]" data-testid="hall-contact-unavailable" role="status">
          القاعة غير متاحة أو مقفلة حالياً، ولا يمكن بدء محادثة.
        </p>
      </div>
    );
  }

  if (!canStartConversation) {
    return (
      <div className="min-w-0 flex-1" dir="rtl">
        <button type="button" className={CONTACT_BUTTON_CLASS} disabled>
          تواصل معنا
        </button>
        <p className="mt-2 text-start text-xs leading-5 text-[#a86267]" data-testid="hall-contact-restricted" role="status">
          حسابك الحالي لا يسمح بمراسلة أصحاب القاعات.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1" dir="rtl">
      <button
        type="button"
        className={CONTACT_BUTTON_CLASS}
        data-testid="hall-contact-button"
        aria-label="تواصل مع صاحب القاعة"
        disabled={submitting}
        aria-busy={submitting}
        onClick={() => void startConversation()}
      >
        {submitting ? "جاري فتح المحادثة…" : "تواصل معنا"}
      </button>
      {error ? (
        <p className="mt-2 text-start text-xs leading-5 text-[#a86267]" data-testid="hall-contact-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
