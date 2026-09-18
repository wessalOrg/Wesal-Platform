import { useT } from "@/i18n";

export default function HallNotificationEmptyState() {
  const t = useT();

  return (
    <div
      className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-8 text-center sm:min-h-56 sm:px-6"
      data-testid="hall-notifications-empty"
      role="status"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[var(--wesal-maroon)] shadow-[0_8px_20px_rgba(90,55,45,0.08)] sm:h-16 sm:w-16">
        <EmptyBellIcon />
      </span>
      <p className="mt-4 max-w-sm text-base font-bold text-[var(--wesal-maroon)]">
        {t("owner.notifications.empty")}
      </p>
      <p className="mt-2 max-w-sm text-sm leading-7 text-[var(--wesal-muted)]">
        {t("owner.notifications.emptyHint")}
      </p>
    </div>
  );
}

function EmptyBellIcon() {
  return (
    <svg
      className="h-7 w-7 sm:h-8 sm:w-8"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.2 9.4a5.8 5.8 0 0 1 11.6 0c0 4.2 1.2 5.3 1.2 5.3H5s1.2-1.1 1.2-5.3Z" />
      <path d="M10 18.2a2 2 0 0 0 4 0" />
      <path d="M8 4.8 16.4 20" />
    </svg>
  );
}
