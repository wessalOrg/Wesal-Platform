const deletedIds = new Set<string>();

export function rememberDeletedHall(hallId: string) {
  const id = hallId.trim();
  if (!id) return;
  deletedIds.add(id);
}

export function isRememberedDeletedHall(hallId: string): boolean {
  return deletedIds.has(hallId.trim());
}

export function excludeDeletedHalls<T extends { id: string }>(halls: T[]): T[] {
  if (deletedIds.size === 0) return halls;
  return halls.filter((hall) => !deletedIds.has(hall.id));
}
