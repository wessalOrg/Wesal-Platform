/** Frontend pagination metadata; totals are never inferred from a partial list. */
export type ContentPage<T> = {
  items: T[];
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasTotalCount?: boolean;
};

export function mergeContent<T extends { id: string }>(previous: T[], incoming: T[]): T[] {
  const records = new Map(previous.map((item) => [item.id, item]));
  for (const item of incoming) records.set(item.id, item);
  return [...records.values()];
}

export function contentTotal(page: ContentPage<unknown>): number | null {
  return page.hasTotalCount === false || !Number.isFinite(page.totalCount) || page.totalCount < 0
    ? null : page.totalCount;
}

export function hasNextContentPage(page: ContentPage<unknown>, pageNumber: number, requestedSize: number) {
  return page.hasTotalCount === false
    ? pageNumber < page.totalPages || page.items.length >= requestedSize
    : pageNumber < page.totalPages;
}
