import type { ReactNode } from "react";
import { useT } from "@/i18n";

type HallNotificationErrorStateProps = {
  message: string;
  action?: ReactNode;
};

export default function HallNotificationErrorState({
  message,
  action,
}: HallNotificationErrorStateProps) {
  const t = useT();

  return (
    <div
      className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-6 text-center sm:min-h-52 sm:px-6"
      role="alert"
      data-testid="hall-notifications-error"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[var(--wesal-maroon)] shadow-[0_8px_20px_rgba(90,55,45,0.08)]">
        <AlertIcon />
      </span>
      <p className="mt-4 text-base font-bold text-[var(--wesal-maroon)]">
        {t("owner.notifications.errorTitle")}
      </p>
      <p className="mt-2 max-w-sm text-sm leading-7 break-words text-[var(--wesal-maroon)]">
        {message}
      </p>
      {action ? <div className="mt-4 w-full max-w-56">{action}</div> : null}
    </div>
  );
}

function AlertIcon() {
  return (
    <svg
      className="h-7 w-7"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 8.5v5" />
      <path d="M12 16.6h.01" />
      <path d="M11.1 4.8 2.8 18.2A1.1 1.1 0 0 0 3.7 20h16.6a1.1 1.1 0 0 0 1-1.8L12.9 4.8a1.1 1.1 0 0 0-1.8 0Z" />
    </svg>
  );
}
