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

export async function loginAccount(payload: LoginPayload): Promise<LoginResult> {
  const { data } = await api.post<LoginResult>("/auth/login", payload);
  return data;
}
