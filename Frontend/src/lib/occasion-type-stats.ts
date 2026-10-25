import {
  OCCASION_TYPE_KEYS,
  type OccasionTypeKey,
  isOccasionTypeKey,
} from "@/lib/occasion-types";

const STORAGE_KEY = "wesal_occasion_type_stats_v1";

export type OccasionTypeCounts = Record<OccasionTypeKey, number>;

const EMPTY: OccasionTypeCounts = {
  wedding: 0,
  family: 0,
  social: 0,
  official: 0,
  educational: 0,
  other: 0,
};

function readRaw(): OccasionTypeCounts {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<Record<string, number>>;
    const next = { ...EMPTY };
    for (const key of OCCASION_TYPE_KEYS) {
      const n = parsed[key];
      next[key] = typeof n === "number" && n > 0 ? Math.floor(n) : 0;
    }
    return next;
  } catch {
    return { ...EMPTY };
  }
}

function writeRaw(counts: OccasionTypeCounts) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
    window.dispatchEvent(new CustomEvent("wesal:occasion-type-stats"));
  } catch {
    /* ignore quota */
  }
}

export function getOccasionTypeCounts(): OccasionTypeCounts {
  return readRaw();
}

export function recordOccasionType(key: string | null | undefined): OccasionTypeCounts {
  if (!isOccasionTypeKey(key)) return readRaw();
  const counts = readRaw();
  counts[key] += 1;
  writeRaw(counts);
  return counts;
}

export function occasionTypeBreakdown(counts: OccasionTypeCounts = readRaw()): {
  total: number;
  segments: Array<{ key: OccasionTypeKey; count: number; percent: number }>;
} {
  const total = OCCASION_TYPE_KEYS.reduce((sum, key) => sum + counts[key], 0);
  const segments = OCCASION_TYPE_KEYS.map((key) => {
    const count = counts[key];
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    return { key, count, percent };
  });
  // Fix rounding so percents sum to 100 when there is data
  if (total > 0) {
    const drift = 100 - segments.reduce((s, x) => s + x.percent, 0);
    const richest = [...segments].sort((a, b) => b.count - a.count)[0];
    if (richest && drift !== 0) richest.percent += drift;
  }
  return { total, segments };
}
