"use client";

import { useT } from "@/i18n";
import type { DeletionFeedbackKind } from "@/lib/owner-deletion-ui";

type DeletionFeedbackProps = {
  id?: string;
  kind: DeletionFeedbackKind;
  message?: string | null;
};

export default function DeletionFeedback({ id, kind, message }: DeletionFeedbackProps) {
  const t = useT();
  const copy =
    message?.trim() ||
    (kind === "conflict"
      ? t("owner.schedule.deleteConflictCallout")
      : kind === "unauthorized"
        ? t("errors.owner.delete.unauthorized")
        : kind === "forbidden"
          ? t("errors.owner.delete.forbidden")
          : kind === "not_found"
            ? t("owner.schedule.alreadyUnavailable")
            : t("owner.schedule.deleteFailureCallout"));

  return (
    <p
      id={id}
      className={`mt-3 min-h-[2.75rem] break-words rounded-xl px-3 py-2 text-sm leading-6 [overflow-wrap:anywhere] ${
        kind === "conflict" || kind === "not_found"
          ? "bg-[var(--wesal-pink-soft)] text-[var(--wesal-maroon)]"
          : "bg-red-50 text-red-700"
      }`}
      role="alert"
      data-testid="hall-schedule-delete-error"
      data-feedback={kind}
    >
      {copy}
    </p>
  );
}
