"use client";

import LoginFormCard from "@/components/auth/LoginFormCard";
import WesalLogo from "@/components/brand/WesalLogo";
import { useT } from "@/i18n";

type LoginScreenProps = {
  registerHref: string;
  redirect?: string;
  action?: string;
};

export default function LoginScreen({ registerHref, redirect, action }: LoginScreenProps) {
  const t = useT();

  return (
    <div
      className="wesal-register-card w-full rounded-[1.4rem] border border-white/70 bg-white/[0.97] p-5 shadow-[0_24px_60px_rgba(60,35,30,0.18)] sm:p-6 lg:p-7"
      data-testid="login-screen"
    >
      <div className="flex flex-col items-center text-center">
        <WesalLogo className="h-9 w-9 sm:h-10 sm:w-10" variant="brand" />
        <h2 className="mt-2.5 text-lg font-extrabold text-[var(--wesal-maroon-dark)] sm:text-xl">
          {t("auth.login.title")}
        </h2>
        <p className="mt-2 max-w-[21rem] text-sm font-normal leading-5 text-[#525252] sm:max-w-[24rem]">
          {t("auth.login.subtitle")}
        </p>
      </div>

      <div className="mt-5">
        <LoginFormCard
          registerHref={registerHref}
          redirectTo={redirect}
          action={action}
        />
      </div>
    </div>
  );
}
