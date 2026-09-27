export const HALL_CREATED_EVENT = "wesal-hall-created";
export const HALL_APPROVED_EVENT = "wesal-hall-approved";
export const HALL_REJECTED_EVENT = "wesal-hall-rejected";

export type HallCreatedDetail = {
  hallId: string | null;
  hallName: string;
};

export type HallApprovedDetail = {
  hallId: string;
  hallName: string;
};

export type HallRejectedDetail = {
  hallId: string;
  hallName: string;
  reason?: string;
};

export function emitHallCreated(detail: HallCreatedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HALL_CREATED_EVENT, { detail }));
}

export function emitHallApproved(detail: HallApprovedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HALL_APPROVED_EVENT, { detail }));
}

export function emitHallRejected(detail: HallRejectedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HALL_REJECTED_EVENT, { detail }));
}
