import { rememberDeletedHall } from "@/lib/owner-deleted-hall-store";

export const HALL_DELETED_EVENT = "wesal-hall-deleted";

export type HallDeletedDetail = {
  hallId: string;
};

export function emitHallDeleted(detail: HallDeletedDetail) {
  const hallId = detail.hallId.trim();
  if (!hallId) return;
  rememberDeletedHall(hallId);
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HALL_DELETED_EVENT, { detail: { hallId } }));
}
