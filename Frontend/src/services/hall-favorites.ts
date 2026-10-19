import api from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";

/**
 * The durable saved-halls list ("المفضلة") backed by `/favorites/halls`. The endpoints are
 * session-scoped, so the caller is always the signed-in user.
 */

/**
 * Whether a real (non-stub) session exists, so the server is the source of truth. Guests and
 * demo/stub logins keep the local store instead of triggering guaranteed 401s.
 */
export function hasHallFavoritesSession(): boolean {
  const token = getAccessToken();
  return typeof token === "string" && token.length > 0 && !token.startsWith("stub-");
}

function normalizeId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The authenticated user's saved hall ids, newest saved first. */
export async function fetchFavoriteHallIds(): Promise<string[]> {
  const { data } = await api.get<unknown>("/favorites/halls", { timeout: 8000 });
  if (!Array.isArray(data)) return [];
  return data.map(normalizeId).filter((id) => id.length > 0);
}

/** Saves a hall. Idempotent server-side, so a retry is safe. */
export async function addFavoriteHall(hallId: string): Promise<void> {
  await api.put(`/favorites/halls/${hallId}`, undefined, { timeout: 8000 });
}

/** Removes a saved hall. Idempotent server-side, so a retry is safe. */
export async function removeFavoriteHall(hallId: string): Promise<void> {
  await api.delete(`/favorites/halls/${hallId}`, { timeout: 8000 });
}
