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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="text-[0.78rem] font-extrabold text-[var(--wesal-maroon)]">
            {t("owner.insights.hallFilterTitle")}
          </p>
          <p className="mt-0.5 text-[0.65rem] font-medium text-[var(--wesal-muted)]">
            {t("owner.insights.hallFilterHint")}
          </p>
        </div>

        <div
          className="flex max-w-full gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
      className={`inline-flex max-w-[11rem] shrink-0 items-center truncate rounded-full border px-3 py-1.5 text-[0.72rem] font-bold transition ${
        active
          ? "border-[#c17b7f] bg-[#c17b7f] text-white shadow-[0_6px_14px_rgba(193,123,127,0.28)]"
          : "border-[rgba(168,98,103,0.22)] bg-[#faf7f5] text-[var(--wesal-text)] hover:border-[#c17b7f] hover:bg-white"
      }`}
    >
      {label}
    </button>
  );
}
