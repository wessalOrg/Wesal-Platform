import api from "@/lib/api";
import { GUEST_SESSION, type SessionState } from "@/types/session";

type SessionResponse = {
  isAuthenticated?: boolean;
  role?: string | null;
  userName?: string | null;
};

export async function fetchSession(): Promise<SessionState> {
  try {
    const { data } = await api.get<SessionResponse>("/session", {
      timeout: 4000,
    });

    return {
      isAuthenticated: Boolean(data.isAuthenticated),
      role: data.role ?? null,
      userName: data.userName ?? null,
    };
  } catch {
    return GUEST_SESSION;
  }
}
