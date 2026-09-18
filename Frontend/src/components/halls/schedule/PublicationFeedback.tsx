"use client";

import { useT } from "@/i18n";
import type { PublicationFeedbackKind } from "@/lib/owner-publication-ui";

type PublicationFeedbackProps = {
  id?: string;
  kind: PublicationFeedbackKind;
  message?: string | null;
};

export default function PublicationFeedback({ id, kind, message }: PublicationFeedbackProps) {
  const t = useT();
  const copy =
    message?.trim() ||
    (kind === "conflict" ? t("owner.schedule.conflictCallout") : t("owner.schedule.failureCallout"));

  return (
    <p
      id={id}
      className="mt-3 break-words rounded-xl bg-red-50 px-3 py-2 text-sm leading-6 text-red-700 [overflow-wrap:anywhere]"
      role="alert"
      data-testid="hall-schedule-publish-error"
      data-feedback={kind}
    >
      {copy}
    </p>
  );
}
