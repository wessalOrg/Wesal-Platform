import { getStoredAuth } from "@/lib/auth-storage";
import { getAccessToken } from "@/lib/auth-token";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segment = token.split(".")[1];
  if (!segment) return null;
  try {
    const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (padded.length % 4)) % 4;
    const json = atob(`${padded}${"=".repeat(padLength)}`);
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readJwtSubject(token: string): string | null {
  const payload = decodeJwtPayload(token);
  const sub = payload?.sub;
  return typeof sub === "string" && sub.trim() ? sub.trim() : null;
}

/** Participant id used to align own vs other bubbles in a thread. */
export function getCurrentUserId(): string | null {
  const stored = getStoredAuth()?.user.id?.trim();
  if (stored) return stored;

  const token = getAccessToken();
  if (!token) return null;
  if (token.startsWith("stub-")) return "demo-user";
  return readJwtSubject(token);
}

export function isSameUserId(left: string, right: string | null): boolean {
  if (!right) return false;
  return left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;
}
