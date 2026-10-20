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
          <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-white p-3 sm:p-3.5">
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-[var(--wesal-pink)]" />
                <span className="h-4 w-28 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                <div className="ms-auto hidden min-w-0 flex-1 gap-4 sm:flex">
                  <div className="min-w-0 flex-1 space-y-2">
                    <span className="block h-3 w-36 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                    <span className="block h-3 w-24 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                    <div className="space-y-2">
                      <span className="block h-3 w-24 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                      <span className="block h-2.5 w-20 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="h-6 w-20 animate-pulse rounded-lg bg-[var(--wesal-pink)]" />
                <span className="h-10 w-28 animate-pulse rounded-xl bg-[var(--wesal-pink)]" />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
