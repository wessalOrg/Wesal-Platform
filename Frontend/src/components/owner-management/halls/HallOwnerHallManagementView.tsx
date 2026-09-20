"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import OwnerAvailabilityCalendar from "@/components/halls/owner-availability/OwnerAvailabilityCalendar";
import HallBookingDataGate from "@/components/halls/HallBookingDataGate";
import OwnerDeleteHallAction from "@/components/halls/OwnerDeleteHallAction";
import ManagementAccessBlockedState from "@/components/halls/ManagementAccessBlockedState";
import PaymentStatusBadge from "@/components/halls/PaymentStatusBadge";
import OwnerSubscriptionStatus from "@/components/halls/subscription/OwnerSubscriptionStatus";
import HallApprovalStatusBadge from "@/components/owner-management/halls/HallApprovalStatusBadge";
import HallManagementForm from "@/components/owner-management/halls/HallManagementForm";
import HallManagementSectionNav from "@/components/owner-management/halls/HallManagementSectionNav";
import { useHallOwnerHallManagement } from "@/hooks/useHallOwnerHallManagement";
import { useSelectedOwnerHall } from "@/hooks/useSelectedOwnerHall";
import {
  canAccessCalendar,
  getManagementAccess,
  hallAccessFromHall,
  mergeHallAccess,
  UNLOCKED_HALL_ACCESS,
} from "@/lib/hall-access";
import {
  HALL_OWNER_HALLS_PATH,
  HALL_OWNER_PROFILE_PATH,
} from "@/lib/account-profile-path";
import { useT } from "@/i18n";

type HallOwnerHallManagementViewProps = {
  hallId: string;
};

/**
 * Multi-Hall management content (US-OWNER-07/08).
 * selectedHallId comes from the route; form/details are Hall-ID scoped.
 */
export default function HallOwnerHallManagementView({
  hallId,
}: HallOwnerHallManagementViewProps) {
  const t = useT();
  const router = useRouter();
  const { isListReady, isListLoading, isKnownOwnedHall, selectedHall } =
    useSelectedOwnerHall();

  const listAccess = selectedHall ? hallAccessFromHall(selectedHall) : UNLOCKED_HALL_ACCESS;
  const listManagement = getManagementAccess(listAccess);
  const listBlocksProtected =
    isListReady &&
    listManagement.allowed === false &&
    listManagement.reason !== "ADMIN_LOCKED";
  const detailsEnabled = !listBlocksProtected && (isKnownOwnedHall || !isListReady);

  const {
    details,
    values,
    fieldErrors,
    formError,
    isLoading,
    isLoadError,
    isPaymentRequired,
    isSystemLocked,
    loadErrorKey,
    isSubmitting,
    isSuccess,
    canEdit,
    controlsDisabled,
    reload,
    patchValues,
    setPeriod,
    removeExistingPhoto,
    submit,
  } = useHallOwnerHallManagement(hallId, detailsEnabled);

  const access = mergeHallAccess(
    details ? hallAccessFromHall(details) : undefined,
    selectedHall ? hallAccessFromHall(selectedHall) : undefined,
  );
  const management = getManagementAccess(access);
  const blockedReason =
    isPaymentRequired
      ? "PAYMENT_REQUIRED"
      : isSystemLocked
        ? "SYSTEM_LOCKED"
        : !management.allowed && management.reason !== "ADMIN_LOCKED"
          ? management.reason
          : null;

  if (isListReady && !isKnownOwnedHall) {
    return (
      <section
        className="owner-hall-mgmt-panel min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6"
        data-testid="owner-hall-management-unknown"
      >
        <p className="break-words text-sm text-[var(--wesal-muted)]">
          {t("owner.management.hallEdit.errors.notFound")}
        </p>
        <Link
          href={HALL_OWNER_PROFILE_PATH}
          className="btn-outline mt-4 inline-flex min-h-11 items-center"
        >
          {t("owner.management.nav.profile")}
        </Link>
      </section>
    );
  }

  if (blockedReason) {
    const headerName = selectedHall?.name || details?.name || "—";
    const hallStatus = selectedHall?.status ?? details?.status ?? "Approved";
    const paymentStatus = selectedHall?.paymentStatus ?? details?.paymentStatus ?? "Unpaid";
    return (
      <section
        className="owner-hall-mgmt-panel min-w-0 space-y-5 sm:space-y-6"
        data-testid={
          blockedReason === "PAYMENT_REQUIRED"
            ? "owner-hall-management-payment-pending"
            : "owner-hall-management-system-locked"
        }
        data-hall-id={hallId}
      >
        <header className="min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6">
          <div className="min-w-0 space-y-4">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="break-words text-xl font-extrabold text-[var(--wesal-maroon)] sm:text-2xl">
                  {headerName}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 self-start">
                <HallApprovalStatusBadge status={hallStatus} />
                <PaymentStatusBadge status={paymentStatus} />
              </div>
            </div>
            <HallManagementSectionNav hallId={hallId} />
          </div>
        </header>
        <ManagementAccessBlockedState reason={blockedReason} />
      </section>
    );
  }

  if (isLoading || (isListLoading && !details)) {
    return (
      <section
        className="owner-hall-mgmt-panel min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6"
        aria-busy="true"
        data-testid="owner-hall-management-loading"
        data-hall-id={hallId}
      >
        <div className="space-y-3">
          <div className="h-7 w-2/3 max-w-md animate-pulse rounded-lg bg-[var(--wesal-pink-soft)]" />
          <div className="h-4 w-full max-w-lg animate-pulse rounded bg-[var(--wesal-pink-soft)]" />
          <div className="mt-6 h-40 w-full animate-pulse rounded-2xl bg-[var(--wesal-pink-soft)]" />
        </div>
        <p className="sr-only">{t("common.loading")}</p>
      </section>
    );
  }

  if (isLoadError) {
    return (
      <section
        className="owner-hall-mgmt-panel min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6"
        role="alert"
        data-testid="owner-hall-management-error"
        data-hall-id={hallId}
      >
        <p className="break-words text-sm text-[var(--wesal-muted)]">
          {t(loadErrorKey ?? "owner.management.hallEdit.errors.loadFailed")}
        </p>
        <button
          type="button"
          className="btn-outline mt-4 min-h-11"
          onClick={() => void reload()}
          data-testid="owner-hall-management-retry"
        >
          {t("common.retry")}
        </button>
      </section>
    );
  }

  if (!details || !values) {
    return (
      <section
        className="owner-hall-mgmt-panel min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6"
        data-hall-id={hallId}
      >
        <p className="break-words text-sm text-[var(--wesal-muted)]">
          {t("owner.management.hallEdit.errors.notFound")}
        </p>
      </section>
    );
  }

  const headerName = details.name || selectedHall?.name || "—";
  const flagsReady = Boolean(details) || isListReady;
  const calendarEnabled = flagsReady && canAccessCalendar(access);

  return (
    <section
      className="owner-hall-mgmt-panel min-w-0 space-y-5 sm:space-y-6"
      data-testid="owner-hall-management-view"
      data-hall-id={hallId}
      data-editable={canEdit ? "true" : "false"}
    >
      <header className="min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6">
        <div className="min-w-0 space-y-4">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="break-words text-xl font-extrabold text-[var(--wesal-maroon)] sm:text-2xl">
                {headerName}
              </h2>
              <p className="mt-1 break-words text-sm text-[var(--wesal-muted)]">
                {canEdit
                  ? t("owner.management.hallEdit.subtitleEditable")
                  : t("owner.management.hallEdit.subtitleReadOnly")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 self-start">
              <HallApprovalStatusBadge status={details.status} />
              <PaymentStatusBadge status={details.paymentStatus} />
            </div>
          </div>
          <HallManagementSectionNav hallId={hallId} />
        </div>
      </header>

      <div className="min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6">
        <HallManagementForm
          values={values}
          fieldErrors={fieldErrors}
          formError={formError}
          editability={details.editability}
          isSubmitting={isSubmitting}
          isSuccess={isSuccess}
          controlsDisabled={controlsDisabled}
          onPatch={patchValues}
          onChangePeriod={setPeriod}
          onRemoveExistingPhoto={removeExistingPhoto}
          onSubmit={() => {
            void submit();
          }}
        />
      </div>

      <OwnerSubscriptionStatus hallId={hallId} hallName={headerName} />
      <HallBookingDataGate access={access} flagsReady={flagsReady}>
        <OwnerAvailabilityCalendar hallId={hallId} enabled={calendarEnabled} />
      </HallBookingDataGate>
      <div className="min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:p-6">
        <OwnerDeleteHallAction
          hallId={hallId}
          hallName={headerName}
          onDeleted={() => {
            router.replace(HALL_OWNER_HALLS_PATH);
          }}
        />
      </div>
    </section>
  );
}
