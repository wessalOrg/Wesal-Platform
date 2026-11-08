/** Backend account types accepted by POST /auth/register (US-REG-01). */
export const ACCOUNT_TYPES = [
  "RegularUser",
  "HallOwner",
  "EventCoordinator",
  "Photographer",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Default selection on the register type toggle (hall seeker). */
export const DEFAULT_ACCOUNT_TYPE: AccountType = "RegularUser";

const STORAGE_KEY = "wesal_register_account_type";

export function isAccountType(value: unknown): value is AccountType {
  return (
    value === "RegularUser" ||
    value === "HallOwner" ||
    value === "EventCoordinator" ||
    value === "Photographer"
  );
}

/** True when registration must continue to a role-specific setup step. */
export function accountTypeRequiresRoleSetup(
  accountType: string | null | undefined,
): boolean {
  return accountType === "EventCoordinator" || accountType === "Photographer";
}

/** Maps marketing links like ?type=owner to the API account type. */
export function accountTypeFromQueryType(type?: string | null): AccountType | null {
  if (!type) return null;
  const normalized = type.trim().toLowerCase();
  if (normalized === "owner" || normalized === "hallowner") return "HallOwner";
  if (normalized === "user" || normalized === "regularuser" || normalized === "regular") {
    return "RegularUser";
  }
  if (
    normalized === "coordinator" ||
    normalized === "eventcoordinator" ||
    normalized === "eventplanner" ||
    normalized === "planner"
  ) {
    return "EventCoordinator";
  }
  if (normalized === "photographer" || normalized === "photo") {
    return "Photographer";
  }
  return null;
}

export function parseAccountType(value?: string | null): AccountType | null {
  if (!value) return null;
  if (isAccountType(value)) return value;
  const lower = value.toLowerCase();
  if (lower === "regularuser") return "RegularUser";
  if (lower === "hallowner") return "HallOwner";
  if (lower === "eventcoordinator") return "EventCoordinator";
  if (lower === "photographer") return "Photographer";
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
 * Priority: explicit accountType param → type=owner shortcut → sessionStorage → default.
 */
export function resolveInitialAccountType(params: {
  accountType?: string | null;
  type?: string | null;
}): AccountType {
  return (
    parseAccountType(params.accountType) ??
    accountTypeFromQueryType(params.type) ??
    readStoredAccountType() ??
    DEFAULT_ACCOUNT_TYPE
  );
}
