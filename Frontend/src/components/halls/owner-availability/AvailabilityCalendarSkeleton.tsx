import "@/components/halls/owner-availability/owner-availability.css";

export default function AvailabilityCalendarSkeleton() {
  return (
    <div
      className="owner-availability-grid"
      aria-busy="true"
      aria-live="polite"
      data-testid="owner-availability-loading"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="owner-availability-day overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-white"
        >
          <div className="border-b border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-3 py-3 sm:px-4">
            <span className="block h-4 w-32 max-w-full animate-pulse rounded-full bg-[var(--wesal-pink)]" />
          </div>
          <div className="space-y-3 px-3 py-3 sm:px-4">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <span className="h-4 w-28 max-w-[55%] animate-pulse rounded-full bg-[var(--wesal-pink)]" />
              <span className="owner-period-switch h-7 max-w-[40%] animate-pulse rounded-full bg-[var(--wesal-pink)]" />
            </div>
            <div className="flex min-h-11 items-center justify-between gap-3">
              <span className="h-4 w-24 max-w-[50%] animate-pulse rounded-full bg-[var(--wesal-pink)]" />
              <span className="owner-period-switch h-7 max-w-[40%] animate-pulse rounded-full bg-[var(--wesal-pink)]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
