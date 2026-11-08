"use client";

import { useT } from "@/i18n";

type RoleRegistrationStepperProps = {
  activeStep: 1 | 2 | 3 | 4;
};

const STEPS = [
  { id: 1, labelKey: "auth.coordinator.setup.step.type" },
  { id: 2, labelKey: "auth.coordinator.setup.step.basic" },
  { id: 3, labelKey: "auth.coordinator.setup.step.setup" },
  { id: 4, labelKey: "auth.coordinator.setup.step.review" },
] as const;

export default function RoleRegistrationStepper({
  activeStep,
}: RoleRegistrationStepperProps) {
  const t = useT();

  return (
    <ol
      className="relative mt-3.5 grid grid-cols-4 gap-0.5"
      aria-label={t("auth.coordinator.setup.stepsAria")}
    >
      <span
        className="pointer-events-none absolute start-[12.5%] end-[12.5%] top-[0.8rem] h-px bg-[color-mix(in_srgb,var(--wesal-maroon)_28%,var(--wesal-border))]"
        aria-hidden="true"
      />
      {STEPS.map((step) => {
        const complete = step.id < activeStep;
        const active = step.id === activeStep;
        return (
          <li key={step.id} className="relative z-[1] flex flex-col items-center gap-1 text-center">
            <span
              className={`grid size-7 place-items-center rounded-full text-[0.7rem] font-bold shadow-sm ${
                complete || active
                  ? "bg-[var(--wesal-maroon)] text-white"
                  : "bg-[#f3ece8] text-[var(--wesal-muted)]"
              }`}
              aria-current={active ? "step" : undefined}
            >
              {complete ? <CheckIcon /> : step.id}
            </span>
            <span
              className={`max-w-[4.5rem] text-[0.58rem] font-semibold leading-3.5 sm:max-w-none sm:text-[0.65rem] ${
                active || complete ? "text-[var(--wesal-maroon)]" : "text-[var(--wesal-muted)]"
              }`}
            >
              {t(step.labelKey)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
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
