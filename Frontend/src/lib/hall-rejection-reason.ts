import type { ThreadMessage } from "@/types/messages";

/**
 * The backend does not store the rejection reason on the hall. It only sends it to the owner as
 * a chat message rendered from the notification catalog, in the owner's language:
 *   ar: تم رفض قاعتك من قِبل الدعم الفني الخاص بوصال للسبب التالي: "<reason>"
 *   en: Your hall was rejected by the Wesal technical support for the following reason: "<reason>"
 * This reads the reason back out of that message.
 */
const REJECTION_MESSAGE =
  /(?:للسبب التالي|for the following reason)\s*:\s*["“”]([\s\S]*?)["“”]\s*$/i;

/** The reason text of a hall-rejection message, `""` when none was given, `null` if not one. */
export function extractHallRejectionReason(content: string | null | undefined): string | null {
  const match = REJECTION_MESSAGE.exec((content ?? "").trim());
  if (!match) return null;
  return match[1].trim();
}

/** The most recent hall-rejection reason in a thread, or `null` when there is none. */
export function latestHallRejectionReason(messages: readonly ThreadMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const reason = extractHallRejectionReason(messages[index]?.content);
    if (reason !== null) return reason;
  }
  return null;
}
