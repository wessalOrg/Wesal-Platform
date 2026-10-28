import api from "@/lib/api";
import { mapOwnerVisitorStats } from "@/lib/owner-visitor-stats";
import type { OwnerVisitorStats } from "@/types/owner-visitor-stats";

/** GET /api/v1/owner/visitor-stats */
export async function fetchOwnerVisitorStats(
  hallId?: string | null,
  signal?: AbortSignal,
): Promise<OwnerVisitorStats> {
  const { data } = await api.get<unknown>("/owner/visitor-stats", { signal, params: hallId ? { hallId } : undefined });
  return mapOwnerVisitorStats(data);
}
