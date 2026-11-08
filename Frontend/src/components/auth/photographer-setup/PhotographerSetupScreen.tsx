"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import WesalLogo from "@/components/brand/WesalLogo";
import CoordinatorSetupPendingSuccess from "@/components/auth/coordinator-setup/CoordinatorSetupPendingSuccess";
import CoordinatorSetupStepper from "@/components/auth/coordinator-setup/CoordinatorSetupStepper";
import PhotographerSetupForm from "@/components/auth/photographer-setup/PhotographerSetupForm";
import { useAuth } from "@/components/auth/AuthProvider";
import { useOptionalUserProfileStore } from "@/components/profile/UserProfileProvider";
import { useProfessionalAccountAccess } from "@/hooks/useProfessionalAccountAccess";
import { useT } from "@/i18n";
import { isPhotographerRole } from "@/lib/account-role";
import { REGULAR_PROFILE_PATH } from "@/lib/account-profile-path";
import { markAuthNavigation } from "@/lib/auth-nav";
import "@/components/auth/role-setup/role-setup.css";

type PhotographerSetupScreenProps = {
  /** Local/design preview without requiring a Photographer session. */
  preview?: boolean;
  /** Show the pending-review success dialog in preview mode. */
  previewPending?: boolean;
  /** Edit/resubmit after rejection or NeedsChanges (Task 5). */
  resubmit?: boolean;
};

export default function PhotographerSetupScreen({
  preview = false,
  previewPending = false,
  resubmit = false,
}: PhotographerSetupScreenProps) {
  const t = useT();
  const router = useRouter();
  const { session, status } = useAuth();
  const professional = useProfessionalAccountAccess();
  const profileStore = useOptionalUserProfileStore();
  const [submitted, setSubmitted] = useState(previewPending);
  const showPending = previewPending || submitted;
  const isResubmitFlow = resubmit && !previewPending;

  useEffect(() => {
    if (preview) return;
    if (status !== "ready") return;
    if (!session.isAuthenticated) {
      markAuthNavigation();
      router.replace(
        `/login?redirect=${encodeURIComponent(
          isResubmitFlow
            ? "/register/photographer-setup?mode=edit"
            : "/register/photographer-setup",
        )}`,
      );
      return;
    }
    if (!isPhotographerRole(session.role)) {
      markAuthNavigation();
      router.replace("/");
      return;
    }
    if (professional.phase === "loading") return;

    if (isResubmitFlow) {
      if (!professional.canResubmitSetup) {
        markAuthNavigation();
        router.replace(REGULAR_PROFILE_PATH);
      }
      return;
    }

    if (
      professional.phase === "pending_review" ||
      professional.phase === "needs_changes" ||
      professional.phase === "rejected" ||
      professional.phase === "approved"
    ) {
      markAuthNavigation();
      router.replace(REGULAR_PROFILE_PATH);
    }
  }, [
    isResubmitFlow,
    preview,
    professional.canResubmitSetup,
    professional.phase,
    router,
    session.isAuthenticated,
    session.role,
    status,
  ]);

  const canView =
    preview ||
    (status === "ready" &&
      session.isAuthenticated &&
      isPhotographerRole(session.role) &&
      (isResubmitFlow
        ? professional.canResubmitSetup || professional.phase === "loading"
        : true));

  if (!canView) {
    return (
      <div
        className="wesal-role-setup-card w-full rounded-[1.35rem] border border-white/70 bg-white p-6 text-center text-sm text-[var(--wesal-muted)] shadow-[0_18px_48px_rgba(60,35,30,0.16)]"
        data-testid="photographer-setup-loading"
      >
        {t("auth.photographer.setup.loading")}
      </div>
    );
  }

  return (
    <div
      className="wesal-role-setup-card w-full rounded-[1.35rem] border border-white/70 bg-white p-4 shadow-[0_18px_48px_rgba(60,35,30,0.16)] sm:p-5"
      data-testid="photographer-setup-screen"
      data-step={showPending ? "pending" : isResubmitFlow ? "resubmit" : "setup"}
    >
      <>
        <div className="flex flex-col items-center text-center">
          <WesalLogo className="h-6 w-auto sm:h-7" variant="brand" />
          <h1 className="wesal-text-bold mt-2 text-lg font-extrabold text-[var(--wesal-maroon)] sm:text-xl">
            {isResubmitFlow
              ? t("auth.photographer.setup.resubmitTitle")
              : t("auth.photographer.setup.title")}
          </h1>
          <p className="mt-1 max-w-[22rem] text-xs font-medium leading-5 text-[var(--wesal-muted)] sm:text-[0.8rem] sm:leading-5">
            {isResubmitFlow
              ? t("auth.photographer.setup.resubmitSubtitle")
              : t("auth.photographer.setup.subtitle")}
          </p>
        </div>

        <CoordinatorSetupStepper activeStep={showPending ? 4 : 3} />

        {!showPending ? (
          <PhotographerSetupForm
            mode={isResubmitFlow ? "resubmit" : "create"}
            onSuccess={() => {
              setSubmitted(true);
              void profileStore?.refetch();
            }}
            onBack={() => {
              markAuthNavigation();
              router.push(
                isResubmitFlow ? REGULAR_PROFILE_PATH : "/register?type=photographer",
              );
            }}
          />
        ) : null}
      </>

      <CoordinatorSetupPendingSuccess open={showPending} />
    </div>
  );
}
