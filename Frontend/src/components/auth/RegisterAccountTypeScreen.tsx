"use client";

import { useId, useState } from "react";
import RegisterFormCard from "@/components/auth/RegisterFormCard";
import WesalLogo from "@/components/brand/WesalLogo";
import { useT } from "@/i18n";
import {
  readStoredAccountType,
  storeAccountType,
  type AccountType,
} from "@/lib/account-type";

type RegisterAccountTypeScreenProps = {
  initialAccountType: AccountType | null;
  loginHref: string;
  previewSuccess?: boolean;
};

const OPTIONS: AccountType[] = ["RegularUser", "HallOwner"];

export default function RegisterAccountTypeScreen({
  initialAccountType,
  loginHref,
  previewSuccess = false,
}: RegisterAccountTypeScreenProps) {
  const t = useT();
  const groupId = useId();
  const [selected, setSelected] = useState<AccountType | null>(() => {
    if (typeof window === "undefined") return initialAccountType;
    return initialAccountType ?? readStoredAccountType();
  });
  const [prevInitialAccountType, setPrevInitialAccountType] =
    useState<AccountType | null>(initialAccountType);
  const [showTypeError, setShowTypeError] = useState(false);
  const [accountTypeError, setAccountTypeError] = useState<string | null>(null);

  if (initialAccountType !== prevInitialAccountType) {
    setPrevInitialAccountType(initialAccountType);
    if (initialAccountType) {
      storeAccountType(initialAccountType);
      setSelected(initialAccountType);
    }
  }
  return (
    <div
      className="wesal-register-card w-full rounded-[1.4rem] border border-white/70 bg-white/[0.97] p-5 shadow-[0_24px_60px_rgba(60,35,30,0.18)] sm:p-6 lg:p-7"
      data-testid="register-account-type-screen"
    >
      <div className="flex flex-col items-center text-center">
        <WesalLogo className="h-9 w-9 sm:h-10 sm:w-10" variant="brand" />
        <h2 className="mt-2.5 text-lg font-extrabold text-[var(--wesal-maroon-dark)] sm:text-xl">
          {t("auth.register.title")}
        </h2>
        <p className="mt-2 max-w-[21rem] text-sm font-normal leading-5 text-[#525252] sm:max-w-[24rem]">
          {t("auth.register.subtitle")}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        className="wesal-register-type-toggle mt-6"
      >
        <span id={`${groupId}-label`} className="sr-only">
          {t("auth.register.form.accountTypeLabel")}
        </span>
        {OPTIONS.map((option) => {
          const isSelected = selected === option;
          const titleKey =
            option === "RegularUser"
              ? "auth.register.type.userTitle"
              : "auth.register.type.ownerTitle";
          const bodyKey =
            option === "RegularUser"
              ? "auth.register.type.userBody"
              : "auth.register.type.ownerBody";
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${t(titleKey)} — ${t(bodyKey)}`}
              data-testid={`register-type-${option}`}
              onClick={() => {
                setSelected(option);
                setShowTypeError(false);
                setAccountTypeError(null);
                storeAccountType(option);
              }}
              className={`wesal-register-type-segment flex flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-[0.82rem] font-semibold sm:px-3 sm:text-sm ${
                isSelected ? "wesal-register-type-segment--active" : ""
              }`}
            >
              <span className="inline-flex shrink-0" aria-hidden="true">
                {option === "RegularUser" ? <UserSegmentIcon /> : <OwnerSegmentIcon />}
              </span>
              <span className="truncate">{t(titleKey)}</span>
            </button>
          );
        })}
      </div>

      {showTypeError || accountTypeError ? (
        <p
          className="mt-3 text-center text-sm font-medium text-[#b42318]"
          role="alert"
          data-testid="register-type-error"
        >
          {accountTypeError ?? t("auth.register.typeRequired")}
        </p>
      ) : null}

      <div className="mt-4 border-t border-[var(--wesal-border)]/80 pt-4">
        <RegisterFormCard
          accountType={selected}
          onRequireAccountType={() => {
            setAccountTypeError(null);
            setShowTypeError(true);
          }}
          onInvalidAccountType={(message) => {
            setShowTypeError(false);
            setAccountTypeError(message);
          }}
          loginHref={loginHref}
          previewSuccess={previewSuccess}
        />
      </div>
    </div>
  );
}

function UserSegmentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 19.5c1.2-3.2 3.6-5 6.5-5s5.3 1.8 6.5 5" strokeLinecap="round" />
    </svg>
  );
}

function OwnerSegmentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M4.5 20.5V11.2L12 5.5l7.5 5.7v8.8" strokeLinejoin="round" />
      <path d="M9.5 20.5v-5h5v5" strokeLinejoin="round" />
    </svg>
  );
}
