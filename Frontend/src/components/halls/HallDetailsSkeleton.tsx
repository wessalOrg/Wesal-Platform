export default function HallDetailsSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" data-testid="hall-details-skeleton">
      <div className="overflow-hidden rounded-2xl border border-[var(--wesal-border)]">
        <div className="aspect-[16/10] animate-pulse bg-[var(--wesal-pink)] sm:aspect-[21/10]" />
        <div className="flex gap-2.5 overflow-hidden p-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-16 w-24 shrink-0 animate-pulse rounded-xl bg-[var(--wesal-pink)] sm:h-20 sm:w-28"
            />
          ))}
        </div>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17.5rem,22rem)] lg:items-start lg:gap-8">
        <div className="order-2 min-w-0 space-y-6 lg:order-1">
          <div className="h-8 w-2/3 animate-pulse rounded bg-[rgba(193,123,127,0.18)]" />
          <div className="flex gap-2">
            <div className="h-8 w-28 animate-pulse rounded-full bg-[rgba(193,123,127,0.12)]" />
            <div className="h-8 w-40 animate-pulse rounded-full bg-[rgba(193,123,127,0.12)]" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-[rgba(193,123,127,0.1)]" />
            <div className="h-4 w-full animate-pulse rounded bg-[rgba(193,123,127,0.1)]" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-[rgba(193,123,127,0.1)]" />
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-11 animate-pulse rounded-xl bg-[rgba(193,123,127,0.1)]"
              />
            ))}
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="rounded-2xl border border-[var(--wesal-border)] bg-white p-5">
            <div className="h-5 w-1/2 animate-pulse rounded bg-[rgba(193,123,127,0.15)]" />
            <div className="mt-4 space-y-3">
              <div className="h-16 animate-pulse rounded-xl bg-[var(--wesal-pink)]" />
              <div className="h-16 animate-pulse rounded-xl bg-[var(--wesal-pink)]" />
            </div>
            <div className="mt-5 space-y-2.5">
              <div className="h-11 animate-pulse rounded-xl bg-[rgba(193,123,127,0.2)]" />
              <div className="h-11 animate-pulse rounded-xl bg-[rgba(193,123,127,0.12)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
