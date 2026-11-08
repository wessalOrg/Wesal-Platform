"use client";

import { useId, useState } from "react";
import RegisterFormCard from "@/components/auth/RegisterFormCard";
import RoleSetupBasicDataForm from "@/components/auth/role-setup/RoleSetupBasicDataForm";
import WesalLogo from "@/components/brand/WesalLogo";
import { useT } from "@/i18n";
import {
  accountTypeRequiresRoleSetup,
  isAccountType,
  readStoredAccountType,
  storeAccountType,
  type AccountType,
} from "@/lib/account-type";

type RegisterAccountTypeScreenProps = {
  initialAccountType: AccountType;
  loginHref: string;
  previewSuccess?: boolean;
};

const OPTIONS: Array<{
  id: AccountType;
  titleKey: string;
  bodyKey: string;
}> = [
  {
    id: "RegularUser",
    titleKey: "auth.register.type.userTitle",
    bodyKey: "auth.register.type.userBody",
  },
  {
    id: "HallOwner",
    titleKey: "auth.register.type.ownerTitle",
    bodyKey: "auth.register.type.ownerBody",
  },
  {
    id: "EventCoordinator",
    titleKey: "auth.register.type.plannerTitle",
    bodyKey: "auth.register.type.plannerBody",
  },
  {
    id: "Photographer",
    titleKey: "auth.register.type.photographerTitle",
    bodyKey: "auth.register.type.photographerBody",
  },
];

export default function RegisterAccountTypeScreen({
  initialAccountType,
  loginHref,
  previewSuccess = false,
}: RegisterAccountTypeScreenProps) {
  const t = useT();
  const groupId = useId();
  const [selected, setSelected] = useState<AccountType>(() => {
    const resolved =
      initialAccountType ??
      (typeof window !== "undefined" ? readStoredAccountType() : null) ??
      "RegularUser";
    if (typeof window !== "undefined" && isAccountType(resolved)) {
      storeAccountType(resolved);
    }
    return isAccountType(resolved) ? resolved : "RegularUser";
  });
  const [prevInitialAccountType, setPrevInitialAccountType] =
    useState<AccountType>(initialAccountType);
  const [step, setStep] = useState<"type" | "form">("type");
  const [showTypeError, setShowTypeError] = useState(false);
  const [accountTypeError, setAccountTypeError] = useState<string | null>(null);

  if (initialAccountType !== prevInitialAccountType) {
    setPrevInitialAccountType(initialAccountType);
    storeAccountType(initialAccountType);
    setSelected(initialAccountType);
  }

  const selectedMeta = OPTIONS.find((option) => option.id === selected);
  const canRegister = Boolean(selectedMeta && isAccountType(selected));

  const onContinue = () => {
    if (!selectedMeta || !isAccountType(selected)) {
      setShowTypeError(true);
      return;
    }
    storeAccountType(selected);
    setAccountTypeError(null);
    setShowTypeError(false);
    setStep("form");
  };

  if (step === "form" && canRegister) {
    if (accountTypeRequiresRoleSetup(selected)) {
      return (
        <RoleSetupBasicDataForm
          accountType={selected}
          loginHref={loginHref}
          onBack={() => setStep("type")}
          onInvalidAccountType={(message) => {
            setShowTypeError(false);
            setAccountTypeError(message);
            setStep("type");
          }}
        />
      );
    }

    return (
      <div
        className="wesal-register-card w-full rounded-xl border border-white/70 bg-white/[0.97] p-4 shadow-[0_14px_36px_rgba(60,35,30,0.14)] sm:p-5"
        data-testid="register-account-type-screen"
        data-step="form"
      >
        <div className="flex flex-col items-center text-center">
          <WesalLogo className="h-6 w-auto sm:h-7" variant="brand" />
          <h2 className="mt-1.5 text-base font-bold text-[var(--wesal-maroon-dark)] sm:text-lg">
            {t("auth.register.title")}
          </h2>
          <p className="mt-1 max-w-[20rem] text-xs font-normal leading-5 text-[#525252] sm:text-sm">
            {t("auth.register.subtitle")}
          </p>
        </div>

        <button
          type="button"
          className="mt-3 text-sm font-bold text-[var(--wesal-maroon)] underline-offset-2 hover:underline"
          data-testid="register-back-to-type"
          onClick={() => setStep("type")}
        >
          {t("auth.register.backToType")}
        </button>

        <div className="mt-3 border-t border-[var(--wesal-border)]/80 pt-3">
          <RegisterFormCard
            accountType={selected}
            onRequireAccountType={() => {
              setAccountTypeError(null);
              setShowTypeError(true);
              setStep("type");
            }}
            onInvalidAccountType={(message) => {
              setShowTypeError(false);
              setAccountTypeError(message);
              setStep("type");
            }}
            loginHref={loginHref}
            previewSuccess={previewSuccess}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="wesal-register-card w-full rounded-[1.15rem] border border-white/70 bg-white/[0.97] p-3.5 shadow-[0_24px_60px_rgba(60,35,30,0.18)] sm:rounded-[1.4rem] sm:p-6 lg:p-6"
      data-testid="register-account-type-screen"
      data-step="type"
    >
      <div className="flex flex-col items-center text-center">
        <WesalLogo className="h-7 w-auto sm:h-10 lg:h-9" variant="brand" />
        <h2 className="wesal-text-bold mt-2 text-[0.95rem] font-extrabold text-[var(--wesal-maroon)] sm:mt-3 sm:text-lg lg:mt-2.5 lg:text-[1.05rem]">
          {t("auth.register.welcome")}
        </h2>
        <p className="mt-1 max-w-[20rem] text-[0.7rem] font-medium leading-4 text-[var(--wesal-muted)] sm:mt-1.5 sm:max-w-[22rem] sm:text-[0.8rem] sm:leading-[1.15rem] lg:mt-1 lg:text-[0.78rem]">
          {t("auth.register.chooseTypeShort")}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        className="mt-3.5 grid grid-cols-2 gap-2.5 sm:mt-6 sm:gap-3 lg:mt-5 lg:gap-3"
      >
        <span id={`${groupId}-label`} className="sr-only">
          {t("auth.register.form.accountTypeLabel")}
        </span>
        {OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              data-testid={`register-type-${option.id}`}
              onClick={() => {
                setSelected(option.id);
                setShowTypeError(false);
                setAccountTypeError(null);
                storeAccountType(option.id);
              }}
              className={`relative flex min-h-[9.5rem] flex-col items-center rounded-2xl border bg-white px-2.5 py-3 text-center transition sm:min-h-[10.25rem] sm:px-3 sm:py-3.5 lg:min-h-[9.5rem] lg:px-3 lg:py-3.5 ${
                isSelected
                  ? "border-[var(--wesal-maroon)] shadow-[0_10px_24px_rgba(193,123,127,0.18)]"
                  : "border-[var(--wesal-border)] hover:border-[color-mix(in_srgb,var(--wesal-maroon)_35%,var(--wesal-border))]"
              }`}
            >
              <span
                className={`absolute start-2.5 top-2.5 grid size-5 place-items-center rounded-full border ${
                  isSelected
                    ? "border-[var(--wesal-maroon)] bg-[var(--wesal-maroon)] text-white"
                    : "border-[color-mix(in_srgb,var(--wesal-maroon)_35%,var(--wesal-border))] bg-white"
                }`}
                aria-hidden="true"
              >
                {isSelected ? <CheckIcon /> : null}
              </span>

              <span
                className="mt-1 inline-flex size-12 items-center justify-center rounded-full bg-[var(--wesal-pink)] text-[var(--wesal-maroon)] sm:size-14 lg:size-[3.25rem]"
                aria-hidden="true"
              >
                <RoleIcon id={option.id} />
              </span>

              <span className="wesal-text-bold mt-2.5 text-[0.92rem] font-extrabold leading-snug text-[var(--wesal-maroon)] sm:text-base lg:mt-2.5 lg:text-[0.95rem]">
                {t(option.titleKey)}
              </span>
              <span className="mt-1 text-[0.72rem] font-medium leading-5 text-[var(--wesal-muted)] sm:text-xs lg:leading-[1.15rem]">
                {t(option.bodyKey)}
              </span>
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

      <button
        type="button"
        className="btn-primary wesal-text-bold mt-5 flex min-h-12 w-full flex-row items-center justify-center gap-2 !rounded-xl !text-base lg:mt-5 lg:min-h-11"
        data-testid="register-type-continue"
        onClick={onContinue}
      >
        <span>{t("auth.register.continue")}</span>
        <span aria-hidden="true">←</span>
      </button>
    </div>
  );
}

function RoleIcon({ id }: { id: AccountType }) {
  if (id === "HallOwner") return <OwnerIcon />;
  if (id === "Photographer") return <CameraIcon />;
  if (id === "EventCoordinator") return <GiftIcon />;
  return <UserIcon />;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.2 6.4 11l6.1-6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <circle cx="12" cy="8.2" r="3.4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.2 19.2c1.1-3.1 3.5-4.8 6.8-4.8s5.7 1.7 6.8 4.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function OwnerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M4.4 20.2V10.8L12 5.2l7.6 5.6v9.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9.4 20.2v-5h5.2v5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M8.2 7.2 9.4 5.5h5.2l1.2 1.7H18a1.8 1.8 0 0 1 1.8 1.8v8.2A1.8 1.8 0 0 1 18 19H6a1.8 1.8 0 0 1-1.8-1.8V9a1.8 1.8 0 0 1 1.8-1.8h2.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13.2" r="3.1" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M5 10.5h14v9.2a1.3 1.3 0 0 1-1.3 1.3H6.3A1.3 1.3 0 0 1 5 19.7v-9.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M4.5 7.2h15v3.3h-15V7.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 7.2v14" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7.2c-1.7-2.4-4.4-2.5-5.2-.8-.7 1.4.4 2.8 2.6 2.8H12c1.8-1.8 3.8-3.5 5.2-2.8.9.5.8 2.4-.8 3.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
