import type { DeleteHallResult } from "@/types/hall";

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function unwrapPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const root = payload as Record<string, unknown>;
  const nested = root.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return root;
}

export function mapDeleteHallResult(payload: unknown, hallId: string): DeleteHallResult {
  const data = unwrapPayload(payload);
  const resolvedId =
    asText(data.hallId) || asText(data.id) || asText(data.deletedHallId) || hallId.trim();
  const alreadyDeleted = Boolean(data.alreadyDeleted || data.isAlreadyDeleted);

  return {
    hallId: resolvedId,
    alreadyDeleted,
  };
}
