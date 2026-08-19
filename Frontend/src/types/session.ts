export type WesalRole = "RegisteredUser" | "HallOwner" | "Admin" | string;

export type SessionState = {
  isAuthenticated: boolean;
  role: WesalRole | null;
  userName: string | null;
};

export const GUEST_SESSION: SessionState = {
  isAuthenticated: false,
  role: null,
  userName: null,
};
