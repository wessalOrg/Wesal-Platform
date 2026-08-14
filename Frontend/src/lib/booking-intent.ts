/** Hall details path; append booking intent when resuming after auth. */
export function buildHallDetailsPath(
  hallId: string,
  withBookingIntent = false,
): string {
  return withBookingIntent
    ? `/halls/${hallId}?action=book`
    : `/halls/${hallId}`;
}

export function hasBookingIntent(
  params: Pick<URLSearchParams, "get"> | { get: (key: string) => string | null },
): boolean {
  const action = params.get("action");
  const book = params.get("book");
  return action === "book" || book === "1";
}

/** Append booking intent query if missing from a hall details path. */
export function withBookingIntent(path: string): string {
  if (path.includes("action=book") || path.includes("book=1")) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}action=book`;
}
