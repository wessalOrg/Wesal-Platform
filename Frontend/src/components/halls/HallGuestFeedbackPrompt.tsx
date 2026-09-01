"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { useT } from "@/i18n";

type HallGuestFeedbackPromptProps = {
  hallId: string;
  isHallOwner: boolean;
};

export default function HallGuestFeedbackPrompt({
  hallId,
  isHallOwner,
}: HallGuestFeedbackPromptProps) {
  const t = useT();
  const { session, status } = useAuth();
  const isGuest = status === "ready" && !session.isAuthenticated;

  if (!isGuest || isHallOwner) {
    return null;
  }

  const loginHref = `/login?redirect=/halls/${hallId}&intent=comment`;
  const registerHref = `/register?redirect=/halls/${hallId}&intent=comment`;
  const linkClass =
    "text-[#8a6a2e] underline decoration-[#c4a05c] decoration-1 underline-offset-[5px] hover:text-[#6b521c] hover:decoration-[#e8c35a]";

  return (
    <p
      className="mx-auto mt-5 max-w-lg text-center text-[15px] font-bold leading-8"
      data-testid="hall-feedback-guest"
    >
      <span className="wesal-gold-wave-text">{t("halls.guest.prompt")}</span>{" "}
      <Link href={loginHref} className={linkClass}>
        {t("halls.guest.login")}
      </Link>{" "}
      <span className="wesal-gold-wave-text">{t("halls.guest.or")}</span>
      <Link href={registerHref} className={linkClass}>
        {t("halls.guest.join")}
      </Link>
    </p>
  );
}
