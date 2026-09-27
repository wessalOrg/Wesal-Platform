"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addressesForCatalogRegion } from "@/constants/regionAddressCatalog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useHallCatalogs } from "@/hooks/useHallCatalogs";
import { REGION_OPTIONS, type HallRegion } from "@/types/hall";

export type HallLocationFilters = {
  region: HallRegion;
  address: string;
  detailedAddress: string;
};

const EMPTY_FILTERS: HallLocationFilters = {
  region: "all",
  address: "",
  detailedAddress: "",
};

function isHallRegion(value: string): value is HallRegion {
  return REGION_OPTIONS.some((option) => option.id === value);
}

export function parseHallFilters(params: URLSearchParams): HallLocationFilters {
  const region = params.get("region") ?? "all";
  return {
    region: isHallRegion(region) ? region : "all",
    address: (params.get("address") ?? params.get("area") ?? "").trim(),
    detailedAddress: (params.get("detailed_address") ?? "").trim(),
  };
}

export function serializeHallFilters(filters: HallLocationFilters): string {
  const params = new URLSearchParams();
  if (filters.region !== "all") params.set("region", filters.region);
  if (filters.address.trim()) params.set("address", filters.address.trim());
  if (filters.detailedAddress.trim()) {
    params.set("detailed_address", filters.detailedAddress.trim());
  }
  return params.toString();
}

export function hasActiveHallFilters(filters: HallLocationFilters): boolean {
  return (
    filters.region !== "all" ||
    Boolean(filters.address.trim()) ||
    Boolean(filters.detailedAddress.trim())
  );
}

export function useHallFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const catalogs = useHallCatalogs();

  const [filters, setFilters] = useState<HallLocationFilters>(() =>
    parseHallFilters(searchParams),
  );
  const [detailedDraft, setDetailedDraft] = useState(filters.detailedAddress);
  const debouncedDetailed = useDebouncedValue(detailedDraft, 400);

  useEffect(() => {
    const fromUrl = parseHallFilters(new URLSearchParams(queryString));
    setFilters((current) =>
      serializeHallFilters(current) === serializeHallFilters(fromUrl) ? current : fromUrl,
    );
    setDetailedDraft((current) =>
      current === fromUrl.detailedAddress ? current : fromUrl.detailedAddress,
    );
  }, [queryString]);

  useEffect(() => {
    setFilters((current) =>
      current.detailedAddress === debouncedDetailed
        ? current
        : { ...current, detailedAddress: debouncedDetailed },
    );
  }, [debouncedDetailed]);

  useEffect(() => {
    const nextQuery = serializeHallFilters(filters);
    if (nextQuery === queryString) return;
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [filters, pathname, queryString, router]);

  const addresses = useMemo(
    () => addressesForCatalogRegion(filters.region, catalogs.addressesByRegion),
    [catalogs.addressesByRegion, filters.region],
  );

  const setRegion = useCallback((region: HallRegion) => {
    setFilters((current) => ({
      ...current,
      region,
      address: region === current.region ? current.address : "",
    }));
  }, []);

  const setAddress = useCallback((address: string) => {
    setFilters((current) => ({ ...current, address }));
  }, []);

  const setDetailedAddress = useCallback((detailedAddress: string) => {
    setDetailedDraft(detailedAddress);
  }, []);

  const resetFilters = useCallback(() => {
    setDetailedDraft("");
    setFilters(EMPTY_FILTERS);
  }, []);

  return {
    filters,
    detailedDraft,
    addresses,
    hasActiveFilters: hasActiveHallFilters(filters),
    setRegion,
    setAddress,
    setDetailedAddress,
    resetFilters,
  };
}
