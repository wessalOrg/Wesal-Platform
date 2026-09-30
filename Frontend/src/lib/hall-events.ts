export const HALL_DELETED_EVENT = "wesal-hall-deleted";

export type HallDeletedDetail = {
  hallId: string;
};

/** In-app bus: any listener on `window` can react to a hall being deleted. */
export function emitHallDeleted(detail: HallDeletedDetail) {
  const hallId = detail.hallId.trim();
  if (!hallId) return;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HALL_DELETED_EVENT, { detail: { hallId } }));
}
