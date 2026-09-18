type HallOwnerHallsListener = () => void;

const listeners = new Set<HallOwnerHallsListener>();

/** Subscribe to Hall Owner halls list invalidation (e.g. after create). */
export function subscribeHallOwnerHallsChanged(
  listener: HallOwnerHallsListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Notify listeners to revalidate halls/status from the server. */
export function notifyHallOwnerHallsChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}
