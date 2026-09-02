/** Backend account types accepted by POST /auth/register (US-REG-01). */
export const ACCOUNT_TYPES = ["RegularUser", "HallOwner"] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

const STORAGE_KEY = "wesal_register_account_type";

export function isAccountType(value: unknown): value is AccountType {
  return value === "RegularUser" || value === "HallOwner";
}

/** Maps marketing links like ?type=owner to the API account type. */
export function accountTypeFromQueryType(type?: string | null): AccountType | null {
  if (!type) return null;
  const normalized = type.trim().toLowerCase();
  if (normalized === "owner" || normalized === "hallowner") return "HallOwner";
  if (normalized === "user" || normalized === "regularuser" || normalized === "regular") {
    return "RegularUser";
  }
  return null;
}

export function parseAccountType(value?: string | null): AccountType | null {
  if (!value) return null;
  if (isAccountType(value)) return value;
  if (value.toLowerCase() === "regularuser") return "RegularUser";
  if (value.toLowerCase() === "hallowner") return "HallOwner";
  return accountTypeFromQueryType(value);
}

export function readStoredAccountType(): AccountType | null {
  if (typeof window === "undefined") return null;
  try {
    return parseAccountType(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function storeAccountType(accountType: AccountType): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, accountType);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearStoredAccountType(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Resolve the account type for the registration flow.
 * Priority: explicit accountType param → type=owner shortcut → sessionStorage.
 */
export function resolveInitialAccountType(params: {
  accountType?: string | null;
  type?: string | null;
}): AccountType | null {
  return (
    parseAccountType(params.accountType) ??
    accountTypeFromQueryType(params.type) ??
    readStoredAccountType()
  );
}

