"use client";

import { useT } from "@/i18n";
import type { AdminMessageFilter, AdminMessageFilterCounts } from "@/types/admin-messages";

type AdminMessageFiltersProps = {
  value: AdminMessageFilter;
  counts: AdminMessageFilterCounts;
  onChange: (next: AdminMessageFilter) => void;
};

const FILTERS: AdminMessageFilter[] = ["all", "conversation", "payment_notice"];

function filterLabelKey(filter: AdminMessageFilter): string {
  if (filter === "conversation") return "admin.messages.filters.conversations";
  if (filter === "payment_notice") return "admin.messages.filters.paymentNotices";
  return "admin.messages.filters.all";
}

export default function AdminMessageFilters({
  value,
  counts,
  onChange,
}: AdminMessageFiltersProps) {
  const t = useT();

  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label={t("admin.messages.filters.label")}
      data-testid="admin-message-filters"
    >
      {FILTERS.map((filter) => {
        const active = value === filter;
        const count = counts[filter];
        return (
          <button
            key={filter}
            type="button"
            role="tab"
            aria-selected={active}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-[var(--wesal-maroon-dark)] text-white shadow-[0_4px_12px_rgba(90,55,45,0.18)]"
                : "bg-[#efefef] text-[var(--wesal-text)] hover:bg-[var(--wesal-pink)]"
            }`}
            data-testid={`admin-message-filter-${filter}`}
            onClick={() => onChange(filter)}
          >
            {t(filterLabelKey(filter))}
            <span className="ms-1 tabular-nums" aria-hidden="true">
              ({count})
            </span>
            <span className="sr-only">{t("admin.messages.filters.count", { count })}</span>
          </button>
        );
      })}
    </div>
  );
}
