export default function SubscriptionStatusSkeleton() {
  return (
    <div
      className="space-y-3"
      aria-busy="true"
      aria-live="polite"
      data-testid="hall-subscription-loading"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <span className="block h-3 w-24 max-w-full animate-pulse rounded-full bg-[var(--wesal-pink)]" />
          <span className="block h-4 w-[80%] max-w-56 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
        </div>
        <span className="h-7 w-[6.5rem] shrink-0 animate-pulse rounded-full bg-[var(--wesal-pink)]" />
      </div>
      <div className="space-y-2 rounded-xl bg-[var(--wesal-pink-soft)] px-3.5 py-3">
        <span className="block h-2.5 w-24 max-w-[70%] animate-pulse rounded-full bg-[var(--wesal-pink)]" />
        <span className="block h-4 w-40 max-w-full animate-pulse rounded-full bg-[var(--wesal-pink)]" />
      </div>
    </div>
  );
}
