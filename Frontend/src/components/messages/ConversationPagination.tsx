"use client";

import { useT } from "@/i18n";

export type InboxPagination = {
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  totalCount: number | null;
  onLoadMore: () => void;
};

export default function ConversationPagination({ pagination }: { pagination?: InboxPagination }) {
  const t = useT();
  if (!pagination || (!pagination.hasMore && !pagination.error)) return null;
  return (
    <div className="shrink-0 border-t border-[var(--wesal-border)] p-3 text-center" aria-busy={pagination.loading}>
      {pagination.error ? <p role="alert" data-testid="inbox-load-more-error" className="mb-2 text-sm text-[var(--wesal-maroon)]">{t("messages.loadMoreError")}</p> : null}
      <button type="button" className="btn-outline min-h-11 w-full" data-testid="inbox-load-more"
        disabled={pagination.loading} onClick={pagination.onLoadMore}>
        {pagination.loading ? t("messages.listLoading") : pagination.error ? t("common.retry") : t("messages.loadMore")}
      </button>
    </div>
  );
}
