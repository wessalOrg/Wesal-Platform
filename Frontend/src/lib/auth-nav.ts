import { sanitizeInternalPath } from "@/lib/auth-storage";

export const AUTH_NAV_KEY = "wesal-auth-nav";

export function markAuthNavigation() {
  try {
    sessionStorage.setItem(AUTH_NAV_KEY, "1");
  } catch {
    // ignore
  }
}

export function consumeAuthNavigation(): boolean {
  try {
    const instant = sessionStorage.getItem(AUTH_NAV_KEY) === "1";
    if (instant) sessionStorage.removeItem(AUTH_NAV_KEY);
    return instant;
  } catch {
    return false;
  }
}

type RouterLike = {
  push: (href: string) => void;
  replace: (href: string) => void;
};

/**
 * Navigate after auth is stored. Retries soft navigation, then hard-navigates
 * to the intended destination. Homepage is only used when the destination is
 * invalid or even a hard navigate to the target fails.
 */
export function navigateAfterAuth(
  router: RouterLike,
  destination: string,
  homepage = "/",
): void {
  const safeHome = sanitizeInternalPath(homepage) ?? "/";
  const target = sanitizeInternalPath(destination) ?? safeHome;

  try {
    router.push(target);
  } catch {
    try {
      router.replace(target);
    } catch {
      hardNavigate(target, safeHome);
      return;
    }
  }

  if (typeof window === "undefined") return;

  window.setTimeout(() => {
    if (!isStuckOnAuthScreen()) return;

    try {
      router.replace(target);
    } catch {
      hardNavigate(target, safeHome);
      return;
    }

    window.setTimeout(() => {
      if (!isStuckOnAuthScreen()) return;
      // Prefer the intended destination; home only if that hard nav fails.
      hardNavigate(target, safeHome);
    }, 400);
  }, 500);
}

function isStuckOnAuthScreen(): boolean {
  const path = window.location.pathname;
  return path === "/login" || path === "/register";
}

function hardNavigate(path: string, homepage: string): void {
  try {
    window.location.assign(path);
  } catch {
    try {
      window.location.href = path;
    } catch {
      window.location.href = homepage;
    }
  }
}
