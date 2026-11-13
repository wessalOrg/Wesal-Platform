/** Backend AccountRequestReviewLimits.MaximumNotesLength */
export const ADMIN_COORDINATOR_REQUEST_CHANGES_NOTES_MAX = 1000;

export type AdminCoordinatorRequestChangesIssue = "required" | "tooLong";

export function validateAdminCoordinatorRequestChangesNotes(
  notes: string,
): AdminCoordinatorRequestChangesIssue | null {
  const trimmed = notes.trim();
  if (!trimmed) return "required";
  if (trimmed.length > ADMIN_COORDINATOR_REQUEST_CHANGES_NOTES_MAX) return "tooLong";
  return null;
}

export function adminCoordinatorRequestChangesNotesMessageKey(
  issue: AdminCoordinatorRequestChangesIssue,
): string {
  switch (issue) {
    case "required":
      return "admin.coordinators.requestChanges.notesRequired";
    case "tooLong":
      return "admin.coordinators.requestChanges.notesTooLong";
  }
}

export function toRequestChangesAdminCoordinatorPayload(notes: string): {
  notes: string;
} {
  return { notes: notes.trim() };
}
