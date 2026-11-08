/** Backend AccountRequestReviewLimits.MaximumNotesLength */
export const ADMIN_PHOTOGRAPHER_REQUEST_CHANGES_NOTES_MAX = 1000;

export type AdminPhotographerRequestChangesIssue = "required" | "tooLong";

export function validateAdminPhotographerRequestChangesNotes(
  notes: string,
): AdminPhotographerRequestChangesIssue | null {
  const trimmed = notes.trim();
  if (!trimmed) return "required";
  if (trimmed.length > ADMIN_PHOTOGRAPHER_REQUEST_CHANGES_NOTES_MAX) return "tooLong";
  return null;
}

export function adminPhotographerRequestChangesNotesMessageKey(
  issue: AdminPhotographerRequestChangesIssue,
): string {
  switch (issue) {
    case "required":
      return "admin.photographers.requestChanges.notesRequired";
    case "tooLong":
      return "admin.photographers.requestChanges.notesTooLong";
  }
}

export function toRequestChangesAdminPhotographerPayload(notes: string): {
  notes: string;
} {
  return { notes: notes.trim() };
}
