type PublicHallsListener = () => void;

const listeners = new Set<PublicHallsListener>();

/**
 * Subscribe to public hall discovery revalidation
 * (featured / catalog / search — server remains source of truth).
 */
export function subscribePublicHallsChanged(
  listener: PublicHallsListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Ask mounted public discovery views to refetch from existing APIs.
 * Does not inject halls — only revalidates queries that are already mounted.
 */
export function notifyPublicHallsChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}
