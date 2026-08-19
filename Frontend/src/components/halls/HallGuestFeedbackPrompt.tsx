"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";

type HallGuestFeedbackPromptProps = {
  hallId: string;
  isHallOwner: boolean;
};

export default function HallGuestFeedbackPrompt({
  hallId,
  isHallOwner,
}: HallGuestFeedbackPromptProps) {
  const { session, status } = useAuth();
  const isGuest = status === "ready" && !session.isAuthenticated;

  if (!isGuest || isHallOwner) {
    return null;
  }

  const loginHref = `/login?redirect=/halls/${hallId}&intent=comment`;
  const registerHref = `/register?redirect=/halls/${hallId}&intent=comment`;
  const linkClass =
    "underline decoration-[#c4a05c] decoration-1 underline-offset-[5px] hover:decoration-[#e8c35a]";

  return (
    <p
      className="wesal-gold-wave-text mx-auto mt-5 max-w-lg text-center text-[15px] font-bold leading-8"
      data-testid="hall-feedback-guest"
    >
      شاركنا تجربتك،{" "}
      <Link href={loginHref} className={linkClass}>
        سجّل الدخول
      </Link>
      {" و"}
      <Link href={registerHref} className={linkClass}>
        انضم إلينا
      </Link>{" "}
      وكن جزءًا من وصال
    </p>
  );
}
