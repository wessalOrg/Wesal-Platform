"use client";

import Link from "next/link";
import { useId } from "react";
import { useHallPermissions } from "@/hooks/useHallPermissions";
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
  const { isGuest, isOwnHall } = useHallPermissions({ isOwner: isHallOwner });

  if (!isGuest || isOwnHall) {
    return null;
  }

  const loginHref = `/login?redirect=/halls/${hallId}&intent=comment`;
  const registerHref = `/register?redirect=/halls/${hallId}&intent=comment`;
  const linkClass =
    "text-[#8a6a2e] underline decoration-[#c4a05c] decoration-1 underline-offset-[5px] hover:text-[#6b521c] hover:decoration-[#e8c35a]";

  return (
    <p
      className="mx-auto mt-5 flex max-w-lg items-center justify-center gap-2 text-center text-[15px] font-bold leading-8"
      data-testid="hall-feedback-guest"
    >
      <PencilIcon />
      <span>
        <span className="wesal-gold-wave-text">{t("halls.guest.prompt")}</span>
        <Link href={registerHref} className={linkClass}>
          {t("halls.guest.join")}
        </Link>
        <span className="wesal-gold-wave-text">{t("halls.guest.or")}</span>
        <Link href={loginHref} className={linkClass}>
          {t("halls.guest.login")}
        </Link>
      </span>
    </p>
  );
}

function PencilIcon() {
  const maskId = `guest-pencil-mask-${useId().replace(/:/g, "")}`;

  return (
    <span className="hall-guest-pencil" aria-hidden="true">
      <svg width="0" height="0" className="absolute">
        <defs>
          <mask
            id={maskId}
            maskUnits="objectBoundingBox"
            maskContentUnits="objectBoundingBox"
          >
            <g
              transform="scale(0.0416667)"
              fill="none"
              stroke="white"
              strokeLinejoin="round"
              strokeLinecap="round"
            >
              <path
                d="M16.8 4.6 19.4 7.2 8.6 18 4.8 19.2 6 15.4Z"
                strokeWidth="1.7"
              />
              <path d="M14.2 7.2 16.8 9.8" strokeWidth="1.7" />
            </g>
          </mask>
        </defs>
      </svg>
      <span
        className="hall-guest-pencil-fill"
        style={{ ["--pencil-mask" as string]: `url(#${maskId})` }}
      />
    </span>
  );
}
