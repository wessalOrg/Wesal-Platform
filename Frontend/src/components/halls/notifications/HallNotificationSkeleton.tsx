export default function HallNotificationSkeleton() {
  return (
    <ul
      className="min-w-0 space-y-3"
      aria-busy="true"
      aria-live="polite"
      data-testid="hall-notifications-loading"
    >
      {[0, 1, 2].map((index) => (
        <li key={index}>
          <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-white px-3.5 py-3 sm:px-4 sm:py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <span className="block h-2.5 w-16 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                <span className="block h-4 w-[70%] max-w-48 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
              </div>
              <span className="h-6 w-16 shrink-0 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <span className="block h-2.5 w-14 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                <span className="block h-4 w-28 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
              </div>
              <div className="space-y-2">
                <span className="block h-2.5 w-12 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                <div className="flex flex-wrap gap-1.5">
                  <span className="h-6 w-16 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                  <span className="h-6 w-20 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                </div>
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
