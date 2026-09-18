/**
 * Result of POST owner Add Hall initiation (US-OWNER-03).
 * Identity comes from the auth token — no client-controlled owner id.
 */
export type AddHallInitiationSuccess = {
  status: "allowed";
  /** Present only when the backend returns a flow/session identifier. */
  initiationId: string | null;
};

export type AddHallInitiationBlocked = {
  status: "blocked";
  message: string;
  code: string | null;
};

export type AddHallInitiationResult =
  | AddHallInitiationSuccess
  | AddHallInitiationBlocked;

export type AddHallInitiationUiState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "blocked"; message: string }
  | { status: "failed"; message: string };
