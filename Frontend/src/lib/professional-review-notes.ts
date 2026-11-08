import { listPlatformNotifications } from "@/lib/platform-notifications-store";
import type { PlatformNotification } from "@/types/platform-notification";
import type { ProfessionalAccountPhase } from "@/types/account-approval";

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

/** Full Admin reason/notes text from the durable/realtime notification body. */
export function professionalReviewNotesBody(
  phase: ProfessionalAccountPhase,
): string | null {
  const notice = findLatestProfessionalReviewNotification(phase);
  const body = notice?.body?.trim() || notice?.message?.trim() || "";
  return body || null;
}
