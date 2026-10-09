/**
 * Frontend mirror of the backend `WesalNavigationRegistry` (the single authoritative
 * allow-list of Mabrouk destinations). It exists for two reasons only:
 *
 *  1. `sanitizeAssistantHref` — whatever href arrives from the backend is checked
 *     against this list before the router is allowed to follow it, so even a bad
 *     payload can never navigate to an external, protocol-relative or invented page.
 *  2. `buildAssistantPageContext` — describes WHERE the user is as a small, validated
 *     pathname (never page content), redacting private ids.
 *
 * `scripts/verify-assistant-contract.ts` asserts that this list equals the backend
 * registry's navigable static routes and that every entry has a real
 * `src/app/**\/page.tsx`. Add a route to both places (backend registry first) when a
 * new page should be reachable by the assistant.
 */

/** Static pages the assistant may send the user to (mirrors the backend registry). */
export const ASSISTANT_STATIC_ROUTES: readonly string[] = [
  "/",
  "/about",
  "/halls",
  "/event-planners",
  "/photographers",
  "/faq",
  "/help",
  "/login",
  "/register",
  "/forgot-password",
  "/profile",
  "/profile/account",
  "/profile/bookings",
  "/profile/favorites",
  "/profile/messages",
  "/profile/notifications",
  "/profile/settings",
  "/owner",
  "/owner/halls",
  "/owner/halls/add",
  "/owner/calendar",
  "/owner/bookings",
  "/owner/messages",
];

const MAX_PATH_LENGTH = 200;
const GUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Routes whose dynamic segment is private; the id is replaced before it is sent anywhere. */
const PRIVATE_DYNAMIC_ROUTES: readonly { pattern: RegExp; redacted: string }[] = [
  { pattern: /^\/messages\/[^/]+$/, redacted: "/messages/_" },
  { pattern: /^\/owner\/halls\/[^/]+$/, redacted: "/owner/halls/_" },
  { pattern: /^\/owner\/halls\/[^/]+\/notifications$/, redacted: "/owner/halls/_/notifications" },
  { pattern: /^\/admin\/halls\/[^/]+$/, redacted: "/admin/halls/_" },
];

const KNOWN_PRIVATE_STATIC: readonly string[] = [
  "/admin",
  "/admin/help-questions",
  "/admin/messages",
  "/admin/rejected-halls",
  "/admin/subscriptions",
  "/owner/profile",
  "/reset-password",
  "/notifications",
  "/messages",
];

/** True for a clean same-app path: no scheme, no `//`, no backslash, no traversal, no control chars. */
export function isCleanInternalPath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const path = value;
  if (path.length === 0 || path.length > MAX_PATH_LENGTH) return false;
  if (path[0] !== "/" || path.startsWith("//")) return false;
  if (path.includes("\\") || path.includes("..") || path.includes("://")) return false;
  if (/[\u0000-\u001f\u007f]/.test(path)) return false;
  return true;
}

/**
 * Returns the canonical internal path when `href` is a real Wesal route the assistant
 * may open, otherwise null. Query strings and fragments are rejected outright (the
 * backend never produces them).
 */
export function sanitizeAssistantHref(href: unknown): string | null {
  if (!isCleanInternalPath(href)) return null;
  if (href.includes("?") || href.includes("#")) return null;

  const path = href.length > 1 ? href.replace(/\/+$/, "") : href;

  if (ASSISTANT_STATIC_ROUTES.includes(path)) return path;

  const hallMatch = /^\/halls\/([^/]+)$/.exec(path);
  if (hallMatch && GUID_RE.test(hallMatch[1] ?? "")) return path;

  return null;
}

export type AssistantPageContext = {
  /** A validated route; private ids are redacted to `_`. */
  pathname: string;
};

/**
 * The small structured "where is the user" envelope sent with each assistant turn.
 * Only a pathname (no query, no fragment, no page content, no tokens). Public hall
 * routes keep their id (the backend re-resolves the hall); any other dynamic id
 * (conversations, owner/admin hall ids) is redacted. Unknown routes yield null.
 */
export function buildAssistantPageContext(
  pathname: string | null | undefined,
): AssistantPageContext | null {
  if (!isCleanInternalPath(pathname)) return null;

  const cut = pathname.search(/[?#]/);
  let path = cut >= 0 ? pathname.slice(0, cut) : pathname;
  if (path.length > 1) path = path.replace(/\/+$/, "");

  if (ASSISTANT_STATIC_ROUTES.includes(path) || KNOWN_PRIVATE_STATIC.includes(path)) {
    return { pathname: path };
  }

  const hallMatch = /^\/halls\/([^/]+)$/.exec(path);
  if (hallMatch) {
    return GUID_RE.test(hallMatch[1] ?? "") ? { pathname: path } : { pathname: "/halls/_" };
  }

  for (const { pattern, redacted } of PRIVATE_DYNAMIC_ROUTES) {
    if (pattern.test(path)) return { pathname: redacted };
  }

  return null;
}

/** The hall id of a `/halls/{guid}` pathname, or null. */
export function hallIdFromPathname(pathname: string | null | undefined): string | null {
  if (!isCleanInternalPath(pathname)) return null;
  const match = /^\/halls\/([^/?#]+)\/?$/.exec(pathname);
  return match && GUID_RE.test(match[1] ?? "") ? (match[1] as string) : null;
}

export function isValidHallId(value: unknown): value is string {
  return typeof value === "string" && GUID_RE.test(value.trim());
}
