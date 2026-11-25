"use client";

import { useT } from "@/i18n";

export default function ContentPagination({ busy, hasMore, loaded, error, onMore, onRetry }: {
  busy: boolean; hasMore: boolean; loaded: boolean; error: unknown;
  onMore: () => void; onRetry: () => void;
}) {
  const t = useT();
  return <div className="mt-5 flex flex-col items-center gap-3 text-sm" data-testid="content-pagination" aria-busy={busy}>
    {error ? <div role="alert" className="text-center text-[var(--wesal-maroon-dark)]">
      <p>{t("content.pagination.error")}</p>
      <button type="button" className="btn-outline mt-2 !min-h-10" disabled={busy} onClick={onRetry}>{t("common.retry")}</button>
    </div> : null}
    {busy ? <p role="status" className="text-[var(--wesal-muted)]">{t("offers.loading")}</p>
      : hasMore && !error ? <button type="button" className="btn-outline !min-h-10" onClick={onMore}>{t("content.pagination.more")}</button>
      : loaded && !error ? <p role="status" className="text-[var(--wesal-muted)]">{t("content.pagination.end")}</p> : null}
  </div>;
}
