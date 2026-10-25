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
      className="wesal-register-card w-full rounded-xl border border-white/70 bg-white/[0.97] p-4 shadow-[0_14px_36px_rgba(60,35,30,0.14)] sm:p-5"
      data-testid="login-screen"
    >
      <div className="flex flex-col items-center text-center">
        <WesalLogo className="h-6 w-auto sm:h-7" variant="brand" />
        <h2 className="mt-1.5 text-base font-extrabold text-[var(--wesal-maroon-dark)] sm:text-lg">
          {t("auth.login.title")}
        </h2>
        <p className="mt-1 max-w-[20rem] text-xs font-normal leading-5 text-[#525252] sm:text-sm">
          {t("auth.login.subtitle")}
        </p>
      </div>

      <div className="mt-3.5">
        <LoginFormCard
          registerHref={registerHref}
          redirectTo={redirect}
          action={action}
        />
      </div>
    </div>
  );
}
