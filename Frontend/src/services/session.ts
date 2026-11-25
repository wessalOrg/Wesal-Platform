import { asWesalRole } from "@/lib/account-role";
import api from "@/lib/api";
import { isUnauthorizedApiError } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";
import { readAuthenticatedAccount } from "@/lib/authenticated-account";
import { readLocalSession } from "@/lib/local-session";
import { GUEST_SESSION, type SessionState, type WesalRole } from "@/types/session";

type SessionResponse = {
  isAuthenticated?: boolean;
  IsAuthenticated?: boolean;
  role?: WesalRole | null;
  Role?: WesalRole | null;
  userName?: string | null;
  UserName?: string | null;
};

function mapSession(data: SessionResponse | null | undefined): SessionState {
  if (!data) return GUEST_SESSION;

  return {
    isAuthenticated: Boolean(data.isAuthenticated ?? data.IsAuthenticated),
    role: asWesalRole(data.role ?? data.Role),
    userName: data.userName ?? data.UserName ?? null,
  };
}

export async function fetchSession(signal?: AbortSignal): Promise<SessionState> {
  const account = readAuthenticatedAccount();
  const token = getAccessToken();
  const local = readLocalSession();
  const fallback = () => {
    // A temporary error may retain only this login's still-usable credentials.
    if (readAuthenticatedAccount() !== account || getAccessToken() !== token) return GUEST_SESSION;
    return readLocalSession() ?? GUEST_SESSION;
  };
  try {
    const { data } = await api.get<SessionResponse>("/session", {
      timeout: 4000,
      signal,
    });
    const authenticated = data?.isAuthenticated ?? data?.IsAuthenticated;
    if (authenticated === false) return GUEST_SESSION;
    // An incomplete response is not an explicit authentication rejection.
    if (authenticated !== true) return fallback();
    const remote = mapSession(data);
    return {
      ...remote,
      userName: remote.userName ?? local?.userName ?? null,
      role: remote.role || local?.role || null,
    };
  } catch (error) {
    if (isUnauthorizedApiError(error)) return GUEST_SESSION;
    // 403 is authorization denial, not proof that the login has expired.
    return fallback();
  }
}
