export type PublicationVisualState =
  | "publishable"
  | "publishing"
  | "published"
  | "conflict"
  | "failure";

export type PublicationFeedbackKind = "conflict" | "generic";

export function publicationFeedbackKind(
  errorKey: string | null | undefined,
): PublicationFeedbackKind | null {
  if (!errorKey) return null;
  const blob = errorKey.toLowerCase();
  if (
    blob.includes("conflict") ||
    blob.includes("unavailable") ||
    blob.includes("no longer available") ||
    blob.includes("لم تعد متاحة") ||
    blob.includes("تعذر النشر")
  ) {
    return "conflict";
  }
  return "generic";
}

export function cardPublicationState(options: {
  published: boolean;
  publishing: boolean;
  errorKey?: string | null;
}): PublicationVisualState {
  if (options.publishing) return "publishing";
  if (options.published) return "published";
  const feedback = publicationFeedbackKind(options.errorKey);
  if (feedback === "conflict") return "conflict";
  if (feedback === "generic") return "failure";
  return "publishable";
}
