"use client";

import { useT } from "@/i18n";
import { REGION_OPTIONS, type HallRegion } from "@/types/hall";

const FIELD_CLASS =
  "h-11 w-full rounded-xl border border-[var(--wesal-border)] bg-white px-3 text-sm text-start text-[var(--wesal-text)] outline-none transition focus:border-[var(--wesal-maroon)] disabled:cursor-not-allowed disabled:bg-[var(--wesal-pink-soft)] disabled:text-[var(--wesal-muted)]";

type HallsFilterBarProps = {
  region: HallRegion;
  address: string;
  detailedAddress: string;
  addresses: string[];
  hasActiveFilters: boolean;
  onRegionChange: (region: HallRegion) => void;
  onAddressChange: (address: string) => void;
  onDetailedAddressChange: (value: string) => void;
  onReset: () => void;
};

export default function HallsFilterBar({
  region,
  address,
  detailedAddress,
  addresses,
  hasActiveFilters,
  onRegionChange,
  onAddressChange,
  onDetailedAddressChange,
  onReset,
}: HallsFilterBarProps) {
  const t = useT();
  const addressDisabled = region === "all";

  return (
    <form
      className="rounded-xl border border-[var(--wesal-border)] bg-white p-3 shadow-[0_8px_24px_rgba(90,55,45,0.06)] sm:p-4"
      onSubmit={(event) => event.preventDefault()}
      role="search"
      aria-label={t("halls.catalog.searchAria")}
      data-testid="halls-filter-bar"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="min-w-0">
          <span className="mb-1.5 block text-sm font-semibold text-[var(--wesal-text)]">
            {t("halls.catalog.region")}
          </span>
          <select
            id="halls-filter-region"
            value={region}
            className={FIELD_CLASS}
            data-testid="halls-filter-region"
            onChange={(event) => onRegionChange(event.target.value as HallRegion)}
          >
            {REGION_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0">
          <span className="mb-1.5 block text-sm font-semibold text-[var(--wesal-text)]">
            {t("halls.catalog.address")}
          </span>
          <select
            id="halls-filter-address"
            value={address}
            disabled={addressDisabled}
            className={FIELD_CLASS}
            data-testid="halls-filter-address"
            onChange={(event) => onAddressChange(event.target.value)}
          >
            <option value="">
              {addressDisabled ? t("halls.catalog.addressDisabled") : t("halls.catalog.addressPick")}
            </option>
            {address && !addresses.includes(address) ? (
              <option value={address}>{address}</option>
            ) : null}
            {addresses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 sm:col-span-2 lg:col-span-1">
          <span className="mb-1.5 block text-sm font-semibold text-[var(--wesal-text)]">
            {t("halls.catalog.detailedAddress")}
          </span>
          <input
            id="halls-filter-detailed-address"
            type="search"
            value={detailedAddress}
            maxLength={150}
            autoComplete="off"
            placeholder={t("halls.catalog.detailedAddressPlaceholder")}
            className={FIELD_CLASS}
            data-testid="halls-filter-detailed-address"
            onChange={(event) => onDetailedAddressChange(event.target.value)}
          />
        </label>
      </div>

      {hasActiveFilters ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="btn-outline !min-h-10 !px-4 !text-sm"
            data-testid="halls-filter-reset"
            onClick={onReset}
          >
            {t("halls.catalog.resetFilters")}
          </button>
        </div>
      ) : null}
    </form>
  );
}
