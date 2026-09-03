import api from "@/lib/api";
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
    role: data.role ?? data.Role ?? null,
    userName: data.userName ?? data.UserName ?? null,
  };
}

export async function fetchSession(): Promise<SessionState> {
  try {
    const { data } = await api.get<SessionResponse>("/session", {
      timeout: 4000,
    });
    const remote = mapSession(data);
    const local = readLocalSession();
    if (remote.isAuthenticated) {
      return {
        ...remote,
        userName: remote.userName ?? local?.userName ?? null,
        role: remote.role ?? local?.role ?? null,
      };
    }
    return local ?? GUEST_SESSION;
  } catch {
    return readLocalSession() ?? GUEST_SESSION;
  }
}
