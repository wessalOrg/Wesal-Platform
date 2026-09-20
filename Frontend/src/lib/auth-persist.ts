const REMEMBER_ME_KEY = "wesal_remember_me";
const REMEMBERED_EMAIL_KEY = "wesal_remembered_email";

/** Preference lives in localStorage so it survives the session itself. */
export function isRememberMeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(REMEMBER_ME_KEY) === "1";
  } catch {
    return false;
  }
}

export function setRememberMeEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMEMBER_ME_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Storage for tokens + auth payload.
 * Remember-me → localStorage; otherwise sessionStorage (cleared when the tab closes).
 */
export function getAuthPersistenceStore(): Storage {
  return isRememberMeEnabled() ? window.localStorage : window.sessionStorage;
}

export function getRememberedEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(REMEMBERED_EMAIL_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function setRememberedEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = email.trim();
    if (!trimmed) {
      window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      return;
    }
    window.localStorage.setItem(REMEMBERED_EMAIL_KEY, trimmed);
  } catch {
    /* ignore */
  }
}

export function clearRememberedEmail(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  } catch {
    /* ignore */
  }
}
