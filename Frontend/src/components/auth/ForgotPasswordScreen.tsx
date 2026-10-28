"use client";

import ForgotPasswordFormCard from "@/components/auth/ForgotPasswordFormCard";
import WesalLogo from "@/components/brand/WesalLogo";
import { useT } from "@/i18n";

export default function ForgotPasswordScreen() {
  const t = useT();

  return (
    <div
      className="wesal-register-card w-full rounded-[1.15rem] border border-white/70 bg-white/[0.97] p-3.5 shadow-[0_24px_60px_rgba(60,35,30,0.18)] sm:rounded-[1.4rem] sm:p-6 lg:p-7"
      data-testid="forgot-password-screen"
    >
      <div className="flex flex-col items-center text-center">
        <WesalLogo className="h-7 w-auto sm:h-9" variant="brand" />
        <h2 className="mt-2 text-base font-extrabold text-[var(--wesal-maroon-dark)] sm:mt-2.5 sm:text-xl">
          {t("auth.forgotPassword.title")}
        </h2>
        <p className="mt-1.5 max-w-[21rem] text-xs font-normal leading-5 text-[#525252] sm:mt-2 sm:max-w-[24rem] sm:text-sm">
          {t("auth.forgotPassword.subtitle")}
        </p>
      </div>

      <div className="mt-3.5 sm:mt-5">
        <ForgotPasswordFormCard />
      </div>
    </div>
  );
}
