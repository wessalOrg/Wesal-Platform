"use client";

import { usePathname, useRouter } from "next/navigation";
import { HALL_OWNER_MANAGEMENT_ACTIONS } from "@/constants/hallOwnerManagementNav";
import { useAddHallInitiation } from "@/hooks/useAddHallInitiation";
import { HALL_OWNER_ADD_HALL_PATH } from "@/lib/account-profile-path";
import { useT } from "@/i18n";

function resolveMessage(t: (key: string) => string, value: string): string {
  return value.startsWith("owner.") || value.startsWith("errors.")
    ? t(value)
    : value;
}

export default function AddHallEntryAction() {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const { state, isInitiating, startAddHall, clearFeedback, warmInitiation } =
    useAddHallInitiation();
  const action = HALL_OWNER_MANAGEMENT_ACTIONS[0];
  const active =
    pathname === HALL_OWNER_ADD_HALL_PATH ||
    pathname.startsWith(`${HALL_OWNER_ADD_HALL_PATH}/`);

  const feedback =
    state.status === "blocked" || state.status === "failed" ? state.message : null;

  const onClick = () => {
    if (isInitiating) return;
    if (feedback) clearFeedback();
    void startAddHall();
  };

  const onPrepare = () => {
    router.prefetch(HALL_OWNER_ADD_HALL_PATH);
    void warmInitiation();
  };

  return (
    <div className="owner-mgmt-action" data-testid="owner-add-hall-entry">
      <button
        type="button"
        className={`seeker-dash-sidebar-link${
          active ? " seeker-dash-sidebar-link--active" : ""
        }${isInitiating ? " owner-mgmt-sidebar-action--busy" : ""}`}
        disabled={isInitiating}
        aria-busy={isInitiating || undefined}
        data-testid="owner-add-hall-button"
        onClick={onClick}
        onMouseEnter={onPrepare}
        onFocus={onPrepare}
        onTouchStart={onPrepare}
      >
        <span className="seeker-dash-sidebar-icon" aria-hidden="true">
          <AddHallIcon />
        </span>
        <span>
          {isInitiating
            ? t("owner.management.addHall.starting")
            : t(action.labelKey)}
        </span>
      </button>

      {feedback ? (
        <div
          role="alert"
          className={`owner-mgmt-action-feedback${
            state.status === "blocked"
              ? " owner-mgmt-action-feedback--blocked"
              : " owner-mgmt-action-feedback--failed"
          }`}
          data-testid={
            state.status === "blocked"
              ? "owner-add-hall-blocked"
              : "owner-add-hall-failed"
          }
        >
          <p className="break-words">{resolveMessage(t, feedback)}</p>
          {state.status === "failed" ? (
            <button
              type="button"
              className="btn-outline owner-mgmt-action-retry"
              disabled={isInitiating}
              data-testid="owner-add-hall-retry"
              onClick={() => {
                void startAddHall();
              }}
            >
              {t("common.retry")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AddHallIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
