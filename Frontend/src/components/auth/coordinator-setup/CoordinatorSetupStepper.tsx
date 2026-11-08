"use client";

import RoleRegistrationStepper from "@/components/auth/role-setup/RoleRegistrationStepper";

type CoordinatorSetupStepperProps = {
  activeStep: 3 | 4;
};

export default function CoordinatorSetupStepper({
  activeStep,
}: CoordinatorSetupStepperProps) {
  return <RoleRegistrationStepper activeStep={activeStep} />;
}
