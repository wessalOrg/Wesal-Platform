import { setStoredAuth } from "@/lib/auth-storage";
import { setAccessToken } from "@/lib/auth-token";
import { buildHallDetailsPath } from "@/lib/booking-intent";
import type { SessionState } from "@/types/session";

export const HOURLY_DEMO_HALL_ID = "1";
export const HOURLY_DEMO_PATH = buildHallDetailsPath(HOURLY_DEMO_HALL_ID, true);

const DEMO_SESSION: SessionState = {
  isAuthenticated: true,
  role: "RegisteredUser",
  userName: "مستخدم وصال",
};

/** Local stub session so hourly booking can be tried before the backend exists. */
export function startHourlyDemoSession(): SessionState {
  setAccessToken("stub-user");
  setStoredAuth({
    token: "stub-user",
    user: {
      id: "demo-user",
      name: DEMO_SESSION.userName ?? "مستخدم وصال",
      email: "demo@wesal.test",
      role: "RegisteredUser",
    },
  });
  return DEMO_SESSION;
}
