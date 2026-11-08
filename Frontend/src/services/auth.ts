import api from "@/lib/api";

/** Render free-tier cold start often exceeds the default 8s axios timeout. */
const AUTH_REQUEST_TIMEOUT_MS = 60_000;

/** Best-effort ping so login/register is less likely to hit a sleeping host. */
export function wakeRemoteApi(): void {
  void api.get("/halls/featured", { timeout: AUTH_REQUEST_TIMEOUT_MS }).catch(() => undefined);
}

export type RegisterPayload = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  accountType: string;
};

/** Backend AccountApprovalStatus (numeric enum). */
export type AccountApprovalStatus = "Approved" | "Pending" | "Rejected" | "NeedsChanges" | number;

export type RegisterResult = {
  id: string;
  fullName: string;
  email: string;
  accountType: string;
  role: string;
  token: string;
  isSetupComplete?: boolean;
  approvalStatus?: AccountApprovalStatus;
};

type RegisterResultDto = RegisterResult & {
  userId?: string;
  Id?: string;
  UserId?: string;
  FullName?: string;
  Email?: string;
  AccountType?: string;
  Role?: string;
  Token?: string;
  IsSetupComplete?: boolean;
  ApprovalStatus?: AccountApprovalStatus;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function mapRegisterResult(data: RegisterResultDto): RegisterResult {
  return {
    id: asText(data.id || data.Id || data.userId || data.UserId),
    fullName: asText(data.fullName || data.FullName),
    email: asText(data.email || data.Email),
    accountType: asText(data.accountType || data.AccountType),
    role: asText(data.role || data.Role),
    token: asText(data.token || data.Token),
    isSetupComplete:
      typeof data.isSetupComplete === "boolean"
        ? data.isSetupComplete
        : typeof data.IsSetupComplete === "boolean"
          ? data.IsSetupComplete
          : undefined,
    approvalStatus: data.approvalStatus ?? data.ApprovalStatus,
  };
}

export async function registerAccount(payload: RegisterPayload): Promise<RegisterResult> {
  const { data } = await api.post<RegisterResultDto>("/auth/register", payload, {
    timeout: AUTH_REQUEST_TIMEOUT_MS,
  });
  return mapRegisterResult(data);
}

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResult = {
  id: string;
  fullName: string;
  email: string;
  accountType: string;
  role: string;
  token: string;
};

export type GoogleAuthResult = {
  requiresRegistration: boolean;
  registrationToken?: string;
  email?: string;
  googleName?: string;
  accountType?: string;
  user?: LoginResult;
};

export async function googleLogin(credential: string, accountType = ""): Promise<GoogleAuthResult> {
  const { data } = await api.post<GoogleAuthResult>("/auth/google/login", { credential, accountType }, { timeout: AUTH_REQUEST_TIMEOUT_MS });
  return data;
}

export async function googleRegister(payload: { registrationToken: string; fullName: string; accountType: string }): Promise<GoogleAuthResult> {
  const { data } = await api.post<GoogleAuthResult>("/auth/google/register", payload, { timeout: AUTH_REQUEST_TIMEOUT_MS });
  return data;
}

type LoginResultDto = LoginResult & {
  userId?: string;
  name?: string;
  accessToken?: string;
  Token?: string;
  AccessToken?: string;
  Role?: string;
  FullName?: string;
  Id?: string;
};

function mapLoginResult(data: LoginResultDto): LoginResult {
  return {
    id: asText(data.id || data.Id || data.userId),
    fullName: asText(data.fullName || data.FullName || data.name),
    email: asText(data.email),
    accountType: asText(data.accountType),
    role: asText(data.role || data.Role),
    token: asText(data.token || data.Token || data.accessToken || data.AccessToken),
  };
}

export async function loginAccount(payload: LoginPayload): Promise<LoginResult> {
  const { data } = await api.post<LoginResultDto>("/auth/login", payload, {
    timeout: AUTH_REQUEST_TIMEOUT_MS,
  });
  return mapLoginResult(data);
}

export type ForgotPasswordResult = {
  message: string;
};

/** Requests a password reset link for the given email (US-LOGIN-06). */
export async function forgotPassword(email: string): Promise<ForgotPasswordResult> {
  const { data } = await api.post<ForgotPasswordResult>(
    "/auth/forgot-password",
    { email },
    { timeout: AUTH_REQUEST_TIMEOUT_MS },
  );
  return data;
}

export type ResetPasswordPayload = {
  email: string;
  token: string;
  newPassword: string;
  confirmPassword: string;
};

export type ResetPasswordResult = {
  message: string;
};

/** Validates the reset token and sets a new password (US-LOGIN-06). */
export async function resetPassword(payload: ResetPasswordPayload): Promise<ResetPasswordResult> {
  const { data } = await api.post<ResetPasswordResult>("/auth/reset-password", payload, {
    timeout: AUTH_REQUEST_TIMEOUT_MS,
  });
  return data;
}

/** Revokes the current session on the server. Callers own local cleanup. */
export async function logoutAccount(accessToken?: string | null): Promise<void> {
  await api.post(
    "/auth/logout",
    null,
    accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  );
}
