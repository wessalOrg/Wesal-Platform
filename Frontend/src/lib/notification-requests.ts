import { isCurrentNotificationAccount, subscribeNotificationAccount, type NotificationAccount } from '@/lib/notification-account';
import { listPlatformNotifications, replacePlatformNotifications, subscribePlatformNotifications } from '@/lib/platform-notifications-store';
import { fetchNotificationsUnreadCount, fetchServerNotifications, markAllServerNotificationsRead, markServerNotificationRead } from '@/services/notifications';
import type { PlatformNotification } from '@/types/platform-notification';

export type NotificationRequestSnapshot = {
  items: PlatformNotification[]; page: number; totalCount: number | null; totalPages: number;
  hasMore: boolean; loading: boolean; error: 'initial' | 'more' | null; unreadCount: number | null;
};
const EMPTY: NotificationRequestSnapshot = { items: [], page: 0, totalCount: null, totalPages: 0,
  hasMore: false, loading: false, error: null, unreadCount: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
export function subscribeNotificationRequests(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function readNotificationRequests(account: NotificationAccount | null): NotificationRequestSnapshot {
  return currentNotificationRequests(account)?.snapshot ?? EMPTY;
}
export const serverNotificationRequests = () => EMPTY;
export function orderNotifications(items: PlatformNotification[]) {
  return [...new Map(items.map(item => [item.id, item])).values()].sort((a, b) =>
    Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id));
}

/** Shared pages and read overlays live only for one continuous authenticated login. */
class NotificationRequests {
  private controller = new AbortController();
  private consumers = 0;
  private hydratedAt = 0;
  private list: Promise<void> | null = null;
  private eventRequestRefresh: Promise<void> | null = null;
  private eventRequestRevision = 0;
  private unread: Promise<number> | null = null;
  private unreadVersion = 0;
  private requestSequence = 0;
  private allReadThrough = 0;
  private pendingReadAll = false;
  private readIds = new Set<string>();
  private writes = new Map<string, Promise<number>>();
  private unsubscribe: () => void;
  private unsubscribeStore: () => void;
  snapshot: NotificationRequestSnapshot = EMPTY;

  constructor(readonly account: NotificationAccount) {
    this.unsubscribe = subscribeNotificationAccount(() => { if (!isCurrentNotificationAccount(account)) this.dispose(); });
    let localIds = new Set(listPlatformNotifications(undefined, account).filter(item => item.id.startsWith('notify-')).map(item => item.id));
    this.unsubscribeStore = subscribePlatformNotifications(() => {
      if (!this.current()) return;
      const next = new Set(listPlatformNotifications(undefined, account).filter(item => item.id.startsWith('notify-')).map(item => item.id));
      const received = [...next].some(id => !localIds.has(id)); localIds = next;
      if (received) { this.unreadVersion += 1; void this.afterPendingUnread(); }
    });
    document.addEventListener('visibilitychange', this.onVisible);
  }
  current = () => !this.controller.signal.aborted && isCurrentNotificationAccount(this.account);
  private update(patch: Partial<NotificationRequestSnapshot>) {
    if (!this.current()) return;
    this.snapshot = { ...this.snapshot, ...patch }; emit();
  }
  private onVisible = () => {
    if (this.current() && document.visibilityState === 'visible') {
      void this.refreshList(true).then(() => this.refreshUnread());
    }
  };
  retain() {
    this.consumers += 1;
    return () => { this.consumers -= 1; if (this.consumers === 0) this.dispose(); };
  }
  private dispose() {
    if (this.controller.signal.aborted) return;
    this.controller.abort(); this.unsubscribe(); this.unsubscribeStore();
    document.removeEventListener('visibilitychange', this.onVisible);
    if (requests.get(this.account) === this) requests.delete(this.account);
    emit();
  }
  refreshList(force = false): Promise<void> {
    if (!this.current()) return Promise.resolve();
    if (this.list) return this.list;
    if (!force && this.hydratedAt && Date.now() - this.hydratedAt < 30_000) return Promise.resolve();
    return this.load(1);
  }
  loadMore(): Promise<void> {
    if (!this.current() || !this.snapshot.hasMore) return Promise.resolve();
    if (this.list) return this.list;
    return this.load(this.snapshot.page + 1);
  }
  /** The hub has no notification ID. Read the persisted rows rather than inventing one. */
  refreshEventRequests(): Promise<void> {
    if (!this.current()) return Promise.resolve();
    this.eventRequestRevision += 1;
    this.unreadVersion += 1;
    if (this.eventRequestRefresh) return this.eventRequestRefresh;
    this.eventRequestRefresh = (async () => {
      if (this.list) await this.list;
      let revision: number;
      do {
        if (!this.current()) return;
        revision = this.eventRequestRevision;
        await this.refreshList(true);
        await this.afterPendingUnread();
      } while (this.current() && revision !== this.eventRequestRevision);
    })().finally(() => { this.eventRequestRefresh = null; });
    return this.eventRequestRefresh;
  }
  retry = () => this.snapshot.error === 'more' ? this.loadMore() : this.refreshList(true);
  private load(page: number): Promise<void> {
    const sequence = ++this.requestSequence;
    this.update({ loading: true, error: null });
    this.list = fetchServerNotifications(page, 40, this.controller.signal).then(result => {
      if (!this.current()) return;
      const rows = result.items.map(item => this.readIds.has(item.id) || this.pendingReadAll || sequence <= this.allReadThrough
        ? { ...item, is_read: true } : item);
      const items = orderNotifications([...this.snapshot.items, ...rows]);
      const loadedPage = Math.max(this.snapshot.page, result.pageNumber);
      this.update({ items, page: loadedPage, totalCount: result.totalCount, totalPages: result.totalPages,
        hasMore: loadedPage < result.totalPages, loading: false, error: null });
      // Keep the durable cache bounded; the complete loaded feed lives in this session entry.
      replacePlatformNotifications(items, this.account);
      this.hydratedAt = Date.now();
    }).catch(() => { this.update({ loading: false, error: page === 1 ? 'initial' : 'more' }); })
      .finally(() => { this.list = null; });
    return this.list;
  }
  refreshUnread(): Promise<number> {
    if (!this.current()) return Promise.resolve(-1);
    if (this.unread) return this.unread;
    const version = this.unreadVersion;
    this.unread = fetchNotificationsUnreadCount(this.controller.signal).then(count => {
      if (!this.current() || version !== this.unreadVersion) return -1;
      this.update({ unreadCount: count }); return count;
    }).catch(() => -1).finally(() => { this.unread = null; });
    return this.unread;
  }
  private async afterPendingUnread() {
    if (this.unread) await this.unread;
    return this.refreshUnread();
  }
  markRead(id?: string): Promise<number> {
    if (!this.current()) return Promise.resolve(-1);
    const key = id ?? 'all';
    const pending = this.writes.get(key); if (pending) return pending;
    this.unreadVersion += 1;
    if (id) this.readIds.add(id);
    else { this.pendingReadAll = true; this.snapshot.items.forEach(item => this.readIds.add(item.id)); }
    this.update({ items: this.snapshot.items.map(item => !id || item.id === id ? { ...item, is_read: true } : item),
      unreadCount: id ? this.snapshot.unreadCount === null ? null : Math.max(0, this.snapshot.unreadCount - 1) : 0 });
    const operation = (id ? markServerNotificationRead(id, this.controller.signal) : markAllServerNotificationsRead(this.controller.signal))
      .then(async () => {
        if (!this.current()) return -1;
        if (!id) { this.allReadThrough = this.requestSequence; this.pendingReadAll = false; }
        return this.afterPendingUnread();
      }).finally(() => { if (!id) this.pendingReadAll = false; this.writes.delete(key); });
    this.writes.set(key, operation); return operation;
  }
}
const requests = new Map<NotificationAccount, NotificationRequests>();
export function retainNotificationRequests(account: NotificationAccount) {
  let entry = requests.get(account);
  if (!entry) { entry = new NotificationRequests(account); requests.set(account, entry); emit(); }
  return { entry, release: entry.retain() };
}
export function currentNotificationRequests(account: NotificationAccount | null) {
  return account && isCurrentNotificationAccount(account) ? requests.get(account) : undefined;
}
