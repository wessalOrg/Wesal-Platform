const seenIds = new Set<string>();

function normalizeId(id: string | null | undefined): string {
  return (id ?? "").trim();
}

export function rememberBookingAlertIds(ids: readonly string[]) {
  for (const id of ids) {
    const next = normalizeId(id);
    if (next) seenIds.add(next);
  }
}

/** Returns true only the first time this request id is seen. */
export function claimNewBookingAlert(id: string): boolean {
  const next = normalizeId(id);
  if (!next) return false;
  if (seenIds.has(next)) return false;
  seenIds.add(next);
  return true;
}

export function resetBookingAlertIds() {
  seenIds.clear();
}
