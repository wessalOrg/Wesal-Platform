import type { SessionState } from "@/types/session";

export type DemoLoginRole =
  | "Admin"
  | "RegisteredUser"
  | "HallOwner"
  | "EventCoordinator"
  | "Photographer";

export type DemoSessionResult = { token: string; session: SessionState };

// The optional, ignored demo-auth.ts replaces this adapter in local development only.
// A clean checkout and every production build use this inert implementation.
export const applyDemoSession: (role: DemoLoginRole) => DemoSessionResult | null = () => null;
