"use client";

import { useT } from "@/i18n";

export type InsightsHallOption = {
  id: string;
  name: string;
};

type OwnerInsightsHallFilterProps = {
  halls: InsightsHallOption[];
  selectedHallId: string | null;
  onSelect: (hallId: string | null) => void;
};

/** Shared hall scope filter above owner insight cards (all halls vs one hall). */
export default function OwnerInsightsHallFilter({
  halls,
  selectedHallId,
  onSelect,
}: OwnerInsightsHallFilterProps) {
  const t = useT();

  if (halls.length === 0) return null;

  return (
    <div
      className="rounded-2xl border border-[rgba(168,98,103,0.14)] bg-white px-3 py-2.5 shadow-[0_6px_18px_rgba(90,55,45,0.04)] sm:px-4"
      data-testid="owner-insights-hall-filter"
    >
      <div className="flex flex-col gap-2">
        <div className="min-w-0">
          <p className="wesal-text-bold text-[0.88rem] font-extrabold leading-snug text-[var(--wesal-maroon)] sm:text-[0.95rem]">
            {t("owner.insights.hallFilterTitle")}
          </p>
          <p className="mt-0.5 text-[0.68rem] font-semibold leading-snug text-[var(--wesal-muted)] sm:text-[0.72rem]">
            {t("owner.insights.hallFilterHint")}
          </p>
        </div>

        <div
          className="flex w-full min-w-0 flex-wrap gap-1.5 px-1"
          role="tablist"
          aria-label={t("owner.insights.hallFilterTitle")}
        >
          <FilterChip
            active={selectedHallId == null}
            label={t("owner.insights.hallFilterAll")}
            onClick={() => onSelect(null)}
            testId="owner-insights-hall-all"
          />
          {halls.map((hall) => (
            <FilterChip
              key={hall.id}
              active={selectedHallId === hall.id}
              label={hall.name}
              onClick={() => onSelect(hall.id)}
              testId={`owner-insights-hall-${hall.id}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
  testId,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={testId}
      onClick={onClick}
      className={`inline-flex min-h-8 min-w-0 flex-1 basis-[calc(33.333%-0.375rem)] items-center justify-center truncate rounded-full border px-2 py-1.5 text-center text-[0.72rem] font-bold transition ${
        active
          ? "border-[#c17b7f] bg-[#c17b7f] text-white"
          : "border-[rgba(168,98,103,0.22)] bg-white text-[var(--wesal-text)] hover:border-[#c17b7f] hover:bg-[var(--wesal-pink-soft)]"
      }`}
    >
      <span className="truncate text-center">{label}</span>
    </button>
  );
}
