import api from "@/lib/api";

export type RegisterPayload = {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  accountType: string;
};

export type RegisterResult = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  accountType: string;
  role: string;
  token: string;
};

export async function registerAccount(payload: RegisterPayload): Promise<RegisterResult> {
  const { data } = await api.post<RegisterResult>("/auth/register", payload);
  return data;
}

export type LoginPayload = {
  identifier: string;
  password: string;
};

export type LoginResult = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  accountType: string;
  role: string;
  token: string;
};

type LoginResultDto = LoginResult & {
  userId?: string;
  name?: string;
  phone?: string;
  accessToken?: string;
  Token?: string;
  AccessToken?: string;
  Role?: string;
  FullName?: string;
  Id?: string;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function mapLoginResult(data: LoginResultDto): LoginResult {
  return {
    id: asText(data.id || data.Id || data.userId),
    fullName: asText(data.fullName || data.FullName || data.name),
    email: asText(data.email),
    phoneNumber: asText(data.phoneNumber || data.phone),
    accountType: asText(data.accountType),
    role: asText(data.role || data.Role),
    token: asText(data.token || data.Token || data.accessToken || data.AccessToken),
  };
}

export async function loginAccount(payload: LoginPayload): Promise<LoginResult> {
  const { data } = await api.post<LoginResultDto>("/auth/login", payload);
  return mapLoginResult(data);
}

/** Revokes the current session on the server. Callers own local cleanup. */
export async function logoutAccount(): Promise<void> {
  await api.post("/auth/logout");
}
