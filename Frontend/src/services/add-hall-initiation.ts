import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import {
  addHallBlockedMessage,
  addHallInitiationErrorMessage,
  isAddHallSubscriptionBlockedError,
} from "@/lib/add-hall-initiation-errors";
import { getAccessToken } from "@/lib/auth-token";
import type { AddHallInitiationResult } from "@/types/add-hall-initiation";

/**
 * Backend initiation contract (wesal-api OwnerController).
 *
 * POST /api/v1/owner/halls/initiate
 * Auth: Bearer token (Hall Owner)
 * Body: none (owner identity from session)
 *
 * Success 200/204:
 *   { allowed?: true, canProceed?: true, initiationId?: string, draftId?: string }
 * Blocked 402/403 (+ subscription code/message):
 *   ProblemDetails / { code, message|detail }
 */
const INITIATION_PATH = "/owner/halls/initiate";

type InitiationDto = {
  allowed?: boolean;
  canProceed?: boolean;
  initiationId?: string | null;
  draftId?: string | null;
  message?: string | null;
  code?: string | null;
  detail?: string | null;
};

function readId(data: InitiationDto): string | null {
  const value = (data.initiationId ?? data.draftId ?? "").trim();
  return value || null;
}

function isExplicitlyDenied(data: InitiationDto): boolean {
  return data.allowed === false || data.canProceed === false;
}

function blockedFromBody(data: InitiationDto): AddHallInitiationResult {
  const message =
    (data.message ?? data.detail ?? "").trim() ||
    "owner.management.addHall.blocked";
  return {
    status: "blocked",
    message,
    code: data.code?.trim() || null,
  };
}

/**
 * Asks the backend whether the authenticated Hall Owner may start Add Hall.
 * Does not create a hall listing from the client.
 */
export async function initiateAddHall(): Promise<AddHallInitiationResult> {
  const token = getAccessToken();
  if (!token || token.startsWith("stub-")) {
    return { status: "allowed", initiationId: "demo-initiation" };
  }

  try {
    const { data, status } = await api.post<InitiationDto | "">(
      INITIATION_PATH,
      {},
      { timeout: 10000 },
    );

    if (status === 204 || data == null || data === "") {
      return { status: "allowed", initiationId: null };
    }

    const body = data as InitiationDto;
    if (isExplicitlyDenied(body)) {
      return blockedFromBody(body);
    }

    return {
      status: "allowed",
      initiationId: readId(body),
    };
  } catch (err) {
    if (isAddHallSubscriptionBlockedError(err)) {
      return {
        status: "blocked",
        message: addHallBlockedMessage(err),
        code: err instanceof ApiError ? err.code ?? null : null,
      };
    }
    throw err instanceof Error
      ? err
      : new Error(addHallInitiationErrorMessage(err));
  }
}

export { addHallInitiationErrorMessage };
