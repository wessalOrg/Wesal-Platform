"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import OwnerDeleteHallAction from "@/components/halls/OwnerDeleteHallAction";
import OwnerHourlyControls from "@/components/halls/hourly/OwnerHourlyControls";
import ManagementAccessBlockedState from "@/components/halls/ManagementAccessBlockedState";
import PaymentStatusBadge from "@/components/halls/PaymentStatusBadge";
import OwnerSubscriptionStatus from "@/components/halls/subscription/OwnerSubscriptionStatus";
import HallApprovalStatusBadge from "@/components/owner-management/halls/HallApprovalStatusBadge";
import HallRejectionReasonNotice from "@/components/owner-management/halls/HallRejectionReasonNotice";
import HallFormActions from "@/components/owner-management/add-hall/HallFormActions";
import HallManagementForm, {
  OWNER_HALL_EDIT_FORM_ID,
} from "@/components/owner-management/halls/HallManagementForm";
import HallManagementSectionNav from "@/components/owner-management/halls/HallManagementSectionNav";
import { useHallOwnerHallManagement } from "@/hooks/useHallOwnerHallManagement";
import { useSelectedOwnerHall } from "@/hooks/useSelectedOwnerHall";
import {
  getManagementAccess,
  hallAccessFromFlags,
  hallAccessFromHall,
  mergeHallAccess,
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

  const detailsEnabled = isKnownOwnedHall || !isListReady;

  const {
    details,
    values,
    fieldErrors,
    formError,
    isLoading,
    isLoadError,
    isPaymentRequired,
    isSystemLocked,
    isAdminLocked,
    loadErrorKey,
    isSubmitting,
    isSuccess,
    canEdit,
    resubmitted,
    controlsDisabled,
    reload,
    patchValues,
    removeExistingPhoto,
    setCoverPhoto,
    addNewPhotos,
    removeNewPhoto,
    submit,
  } = useHallOwnerHallManagement(hallId, detailsEnabled);

  const access = mergeHallAccess(
    details ? hallAccessFromHall(details) : undefined,
    selectedHall ? hallAccessFromHall(selectedHall) : undefined,
    hallAccessFromFlags(isAdminLocked, isSystemLocked, {
      paymentStatus: isPaymentRequired ? "Unpaid" : undefined,
    }),
  );
  const management = getManagementAccess(access);
  const blockedReason =
    !management.allowed && management.reason !== "PAYMENT_REQUIRED"
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
          blockedReason === "ADMIN_LOCKED" ||
          blockedReason === "ADMIN_AND_SYSTEM_LOCKED"
            ? "owner-hall-management-admin-locked"
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
        <ManagementAccessBlockedState
          reason={blockedReason}
          hallId={hallId}
          hallName={headerName}
          paymentStatus={paymentStatus}
        />
        <div className="flex min-w-0 justify-center">
          <div className="w-full max-w-xs">
            <OwnerDeleteHallAction
              hallId={hallId}
              hallName={headerName}
              onDeleted={() => {
                router.replace(HALL_OWNER_HALLS_PATH);
              }}
            />
          </div>
        </div>
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

      <HallRejectionReasonNotice hallId={hallId} rejected={details.status === "Rejected"} />

      <div className="min-w-0 space-y-6 rounded-2xl border border-[var(--wesal-border)] bg-white p-4 sm:space-y-8 sm:p-6">
        <HallManagementForm
          values={values}
          fieldErrors={fieldErrors}
          formError={formError}
          editability={details.editability}
          isSubmitting={isSubmitting}
          isSuccess={isSuccess}
          controlsDisabled={controlsDisabled}
          hideActions
          onPatch={patchValues}
          onRemoveExistingPhoto={removeExistingPhoto}
          onSetCover={setCoverPhoto}
          onAddNewPhotos={addNewPhotos}
          onRemoveNewPhoto={removeNewPhoto}
          onSubmit={() => {
            void submit();
          }}
          successMessage={
            resubmitted
              ? t("owner.management.hallEdit.resubmitted")
              : t("owner.management.hallEdit.success")
          }
        />

        <div
          className="grid min-w-0 grid-cols-1 items-start gap-4 border-t border-[var(--wesal-border)] pt-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:gap-4"
          data-testid="owner-hall-booking-subscription-panel"
        >
          {/* RTL: first column sits on the right and takes more than half */}
          <OwnerHourlyControls
            hallId={hallId}
            disabled={controlsDisabled}
            paymentStatus={details.paymentStatus}
            embedded
          />
          <OwnerSubscriptionStatus
            hallId={hallId}
            hallName={headerName}
            embedded
          />
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
        {/* RTL: first column sits on the right (save), second on the left (delete) */}
        <HallFormActions
          isSubmitting={isSubmitting}
          formError={formError}
          isSuccess={isSuccess}
          resolveMessage={(value) =>
            value && (value.startsWith("owner.") || value.startsWith("errors."))
              ? t(value)
              : value
          }
          submitLabel={t("owner.management.hallEdit.actions.save")}
          savingLabel={t("owner.management.hallEdit.actions.saving")}
          successMessage={
            resubmitted
              ? t("owner.management.hallEdit.resubmitted")
              : t("owner.management.hallEdit.success")
          }
          submitDisabled={details.editability === "locked"}
          submitTestId="owner-hall-edit-submit"
          successTestId="owner-hall-edit-success"
          errorTestId="owner-hall-edit-form-error"
          formId={OWNER_HALL_EDIT_FORM_ID}
          endCard={{
            cancelHref: HALL_OWNER_HALLS_PATH,
          }}
        />

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
