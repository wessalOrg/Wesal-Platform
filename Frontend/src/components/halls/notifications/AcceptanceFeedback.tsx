"use client";

import { useT } from "@/i18n";
import type { AcceptFeedbackKind } from "@/lib/owner-acceptance-ui";

type AcceptanceFeedbackProps = {
  id?: string;
  kind: AcceptFeedbackKind | "cancelled-status" | "finalized";
  message?: string;
};

export default function AcceptanceFeedback({ id, kind, message }: AcceptanceFeedbackProps) {
  const t = useT();
  const copy =
    message ??
    (kind === "cancelled" || kind === "cancelled-status"
      ? t("owner.notifications.cancelledBanner")
      : kind === "conflict"
        ? t("owner.notifications.conflictBanner")
        : kind === "finalized"
          ? t("owner.notifications.finalizedHint")
          : t("errors.owner.accept.generic"));
  const tone =
    kind === "finalized"
      ? "bg-[var(--wesal-pink-soft)] text-[var(--wesal-muted)]"
      : kind === "cancelled" || kind === "cancelled-status"
        ? "bg-[var(--wesal-pink-soft)] text-[var(--wesal-maroon)]"
        : "bg-red-50 text-red-700";

  return (
    <p
      id={id}
      className={`mt-3 rounded-xl px-3 py-2 text-sm leading-6 ${tone}`}
      role={kind === "finalized" ? "status" : "alert"}
      data-testid="hall-notification-accept-error"
      data-feedback={kind}
    >
      {copy}
    </p>
  );
}
