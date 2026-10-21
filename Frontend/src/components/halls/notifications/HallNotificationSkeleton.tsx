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
          <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-white p-3 lg:p-0">
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:gap-0">
              <div className="flex items-center gap-2.5 lg:w-[13.5rem] lg:px-3.5 lg:py-3.5">
                <span className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-[var(--wesal-pink)]" />
                <span className="h-4 w-24 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
              </div>
              <div className="hidden w-px self-stretch bg-[var(--wesal-border)] lg:block" />
              <div className="flex flex-1 items-start gap-2 lg:px-3.5 lg:py-3.5">
                <span className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                <div className="space-y-2">
                  <span className="block h-3 w-24 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                  <span className="block h-2.5 w-28 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                </div>
              </div>
              <div className="hidden w-px self-stretch bg-[var(--wesal-border)] lg:block" />
              <div className="flex flex-1 items-start gap-2 lg:px-3.5 lg:py-3.5">
                <span className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                <div className="space-y-2">
                  <span className="block h-3 w-16 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                  <span className="block h-2.5 w-28 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                </div>
              </div>
              <div className="hidden w-px self-stretch bg-[var(--wesal-border)] lg:block" />
              <div className="flex flex-1 items-center gap-2 lg:px-3.5 lg:py-3.5">
                <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                <div className="space-y-2">
                  <span className="block h-3 w-24 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                  <span className="block h-2.5 w-20 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                </div>
              </div>
              <div className="hidden w-px self-stretch bg-[var(--wesal-border)] lg:block" />
              <div className="flex w-full flex-col items-end gap-2 lg:w-[11.5rem] lg:px-3.5 lg:py-3.5">
                <span className="h-6 w-20 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
                <span className="h-10 w-full animate-pulse rounded-xl bg-[var(--wesal-pink)]" />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
