"use client";

import { useT } from "@/i18n";
import type { HallDeletionFeedbackKind } from "@/lib/owner-hall-deletion-ui";

type HallDeletionFeedbackProps = {
  id?: string;
  kind: HallDeletionFeedbackKind;
  message?: string | null;
};

export default function HallDeletionFeedback({ id, kind, message }: HallDeletionFeedbackProps) {
  const t = useT();
  const copy =
    message && (message.startsWith("errors.") || message.startsWith("owner."))
      ? t(message)
      : message?.trim() ||
        (kind === "conflict"
          ? t("owner.hall.deleteConflictCallout")
          : kind === "unauthorized"
            ? t("errors.owner.hall.unauthorized")
            : kind === "forbidden"
              ? t("errors.owner.hall.forbidden")
              : kind === "not_found"
                ? t("owner.hall.alreadyUnavailable")
                : t("owner.hall.deleteFailureCallout"));

  const warning = kind === "conflict" || kind === "not_found";

  return (
    <p
      id={id}
      className={`min-h-[2.75rem] break-words rounded-xl px-3 py-2 text-sm leading-6 [overflow-wrap:anywhere] ${
        warning
          ? "bg-[var(--wesal-pink-soft)] text-[var(--wesal-maroon)]"
          : "bg-red-50 text-red-700"
      }`}
      role="alert"
      data-testid="hall-delete-error"
      data-feedback={kind}
    >
      {copy}
    </p>
  );
}
