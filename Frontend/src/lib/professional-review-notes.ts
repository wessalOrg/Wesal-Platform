import { listPlatformNotifications } from "@/lib/platform-notifications-store";
import type { PlatformNotification } from "@/types/platform-notification";
import type { ProfessionalAccountPhase } from "@/types/account-approval";
import type { ThreadMessage } from "@/types/messages";

/**
 * Latest Admin review notice for a professional account status panel.
 * Reasons/notes come only from backend-localized notification bodies — never fabricated.
 */
export function findLatestProfessionalReviewNotification(
  phase: ProfessionalAccountPhase,
): PlatformNotification | null {
  const types =
    phase === "rejected"
      ? (["registration_rejected"] as const)
      : phase === "needs_changes"
        ? (["registration_needs_changes"] as const)
        : [];
  if (types.length === 0) return null;

  const items = listPlatformNotifications("seeker")
    .filter((item) => (types as readonly string[]).includes(item.type))
    .sort(
      (a, b) =>
        Date.parse(b.created_at) - Date.parse(a.created_at) ||
        b.id.localeCompare(a.id),
    );
  return items[0] ?? null;
}

/**
 * Pull the Admin-authored reason out of a rejection notification body.
 * Backend templates wrap the reason in quotes: … : "reason"
 */
export function extractRegistrationReviewReason(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  const quoted = trimmed.match(/[«"“]([^»"”]+)[»"”]/u);
  const reason = quoted?.[1]?.trim();
  return reason || trimmed;
}

/** Full Admin reason/notes text from the durable/realtime notification body. */
export function professionalReviewNotesBody(
  phase: ProfessionalAccountPhase,
): string | null {
  const notice = findLatestProfessionalReviewNotification(phase);
  const raw = notice?.body?.trim() || notice?.message?.trim() || "";
  if (!raw) return null;
  if (phase === "rejected") {
    const reason = extractRegistrationReviewReason(raw);
    return reason || null;
  }
  // NeedsChanges notification body is a pointer to the Admin chat — not the notes.
  return null;
}

/**
 * Conversation messages hold NeedsChanges notes (and also the rejection reason).
 * Prefer the latest message that is not from the applicant.
 */
export function professionalReviewNotesFromThread(
  messages: ThreadMessage[],
  viewerUserId: string | null | undefined,
): string | null {
  const viewer = viewerUserId?.trim().toLowerCase() || "";
  const ordered = [...messages].sort(
    (a, b) =>
      Date.parse(b.sentAt) - Date.parse(a.sentAt) || a.id.localeCompare(b.id),
  );
  for (const message of ordered) {
    const content = message.content?.trim() || "";
    if (!content) continue;
    const sender = message.senderUserId?.trim().toLowerCase() || "";
    if (viewer && sender && sender === viewer) continue;
    return content;
  }
  // Fallback: any non-empty message (single-message rejection threads).
  for (const message of ordered) {
    const content = message.content?.trim() || "";
    if (content) return content;
  }
  return null;
}
