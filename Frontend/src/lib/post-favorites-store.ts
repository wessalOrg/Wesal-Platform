import {
  isCurrentAuthenticatedAccount, readAuthenticatedAccount, subscribeAuthenticatedAccount,
  type AuthenticatedAccount,
} from "@/lib/authenticated-account";
import { addPostFavorite, fetchFavoritePosts, removePostFavorite } from "@/services/post-interactions";
import type { FavoritePost, PagedResult } from "@/types/posts";
import { isUnauthorizedApiError } from "@/lib/api-error";

export type FavoriteRead = { version: number; sequence: number };
type Snapshot = {
  ids: ReadonlySet<string>;
  unsaved: ReadonlySet<string>;
  counts: ReadonlyMap<string, number>;
  pending: ReadonlySet<string>;
  errors: ReadonlyMap<string, string>;
  status: "idle" | "loading" | "ready" | "error";
  complete: boolean;
  errorKey: string | null;
  requiresLogin: boolean;
  revision: number;
};
const empty = (): Snapshot => ({ ids: new Set(), unsaved: new Set(), counts: new Map(),
  pending: new Set(), errors: new Map(), status: "idle", complete: false, errorKey: null, requiresLogin: false, revision: 0 });
const guestSnapshot = empty();
type Store = {
  account: AuthenticatedAccount;
  snapshot: Snapshot;
  version: number;
  sequence: number;
  completedRead: number;
  changes: Map<string, { saved: boolean; version: number }>;
  operations: Map<string, Promise<boolean>>;
  request: Promise<void> | null;
};
let store: Store | null = null;
const listeners = new Set<() => void>();
let unsubscribeAuth: (() => void) | null = null;

function synchronize(): Store | null {
  const account = readAuthenticatedAccount();
  if (store?.account !== account) {
    store = account ? { account, snapshot: empty(), version: 0, sequence: 0, completedRead: 0,
      changes: new Map(), operations: new Map(), request: null } : null;
  }
  return store;
}
function current(owner: Store): boolean {
  return isCurrentAuthenticatedAccount(owner.account) && synchronize() === owner;
}
function owned(account: AuthenticatedAccount | null): Store | null {
  const owner = synchronize();
  return account && owner?.account === account && current(owner) ? owner : null;
}
function publish(owner: Store, patch: Partial<Snapshot>) {
  if (!current(owner)) return;
  owner.snapshot = { ...owner.snapshot, ...patch };
  listeners.forEach(listener => listener());
}
export function subscribePostFavorites(listener: () => void) {
  listeners.add(listener);
  if (!unsubscribeAuth) unsubscribeAuth = subscribeAuthenticatedAccount(() => {
    synchronize(); listeners.forEach(notify => notify());
  });
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { unsubscribeAuth?.(); unsubscribeAuth = null; }
  };
}
export const getPostFavoritesSnapshot = () => synchronize()?.snapshot ?? guestSnapshot;
export const getServerPostFavoritesSnapshot = () => guestSnapshot;
export function savedPostState(snapshot: Snapshot, postId: string): boolean | null {
  if (snapshot.ids.has(postId)) return true;
  return snapshot.unsaved.has(postId) || snapshot.complete ? false : null;
}
export function captureFavoriteRead(account: AuthenticatedAccount | null): FavoriteRead {
  const owner = owned(account);
  return owner ? { version: owner.version, sequence: ++owner.sequence } : { version: -1, sequence: -1 };
}
function applyRead(owner: Store, ids: Set<string>, read: FavoriteRead, complete: boolean) {
  if (!current(owner) || read.sequence < owner.completedRead) return;
  const nextIds = complete ? ids : new Set([...owner.snapshot.ids, ...ids]);
  const unsaved = complete ? new Set<string>() : new Set(owner.snapshot.unsaved);
  for (const id of ids) unsaved.delete(id);
  for (const [id, change] of owner.changes) {
    if (change.version > read.version || owner.snapshot.pending.has(id)) {
      if (change.saved) { nextIds.add(id); unsaved.delete(id); }
      else { nextIds.delete(id); unsaved.add(id); }
    }
  }
  if (complete) owner.completedRead = read.sequence;
  publish(owner, { ids: nextIds, unsaved, complete: complete || owner.snapshot.complete,
    ...(complete ? { status: "ready", errorKey: null, requiresLogin: false } : {}) });
}
/** A positive row is evidence. Absence is evidence only for a complete collection. */
export function observeFavoritePage(account: AuthenticatedAccount | null, page: PagedResult<FavoritePost>, read: FavoriteRead) {
  const owner = owned(account);
  if (!owner) return;
  const complete = page.pageNumber === 1 && page.totalPages <= 1 && owner.version === read.version && !owner.snapshot.pending.size;
  applyRead(owner, new Set(page.items.map(post => post.id)), read, complete);
}
/** One paginated hydration per login, shared by all cards and details. No per-post GETs. */
export function hydratePostFavorites(account: AuthenticatedAccount | null, refresh = false): Promise<void> {
  const owner = owned(account);
  if (!owner) return Promise.resolve();
  if (owner.request) return owner.request;
  if (owner.snapshot.complete && !refresh) return Promise.resolve();
  // Assign the shared promise before notifying React subscribers.
  const request = Promise.resolve().then(async () => {
    if (!current(owner)) return;
    publish(owner, { status: "loading", errorKey: null, requiresLogin: false });
    try {
      while (current(owner)) {
        const read = captureFavoriteRead(account);
        const ids = new Set<string>();
        let number = 1;
        do {
          const page = await fetchFavoritePosts(number, 100);
          if (!current(owner)) return;
          if (page.pageNumber !== number || !Number.isInteger(page.totalPages) || page.totalPages < 0
            || (!page.items.length && number < page.totalPages)) throw new Error("Incomplete favorites pagination");
          for (const post of page.items) ids.add(post.id);
          applyRead(owner, new Set(page.items.map(post => post.id)), read, false);
          if (number >= page.totalPages) break;
          number += 1;
        } while (current(owner));
        if (!current(owner)) return;
        // Offset pages can shift after a local mutation. Recollect once writes settle
        // rather than declare a mixed snapshot complete or lose a boundary record.
        if (owner.version !== read.version || owner.snapshot.pending.size) {
          await Promise.allSettled([...owner.operations.values()]);
          continue;
        }
        applyRead(owner, ids, read, true);
        publish(owner, { status: "ready", errorKey: null });
        break;
      }
    } catch (error) {
      if (current(owner)) publish(owner, { status: "error", requiresLogin: isUnauthorizedApiError(error),
        errorKey: isUnauthorizedApiError(error) ? "posts.favorites.errors.unauthorized" : "posts.favorites.errors.loadFailed" });
    }
  }).finally(() => { if (owner.request === request) owner.request = null; });
  owner.request = request;
  return request;
}
function record(owner: Store, postId: string, saved: boolean) {
  owner.changes.set(postId, { saved, version: ++owner.version });
  const ids = new Set(owner.snapshot.ids), unsaved = new Set(owner.snapshot.unsaved);
  if (saved) { ids.add(postId); unsaved.delete(postId); }
  else { ids.delete(postId); unsaved.add(postId); }
  publish(owner, { ids, unsaved });
}
export function markPostSaved(account: AuthenticatedAccount | null, postId: string, saved: boolean) {
  const owner = owned(account);
  if (owner && savedPostState(owner.snapshot, postId) !== saved) record(owner, postId, saved);
}
export function rememberPostSaveCount(account: AuthenticatedAccount | null, postId: string, count: number) {
  const owner = owned(account);
  if (!owner || owner.snapshot.counts.has(postId)) return;
  publish(owner, { counts: new Map(owner.snapshot.counts).set(postId, Math.max(0, count)) });
}
export function setPostSaved(account: AuthenticatedAccount | null, postId: string, saved: boolean): Promise<boolean> {
  const owner = owned(account);
  if (!owner) return Promise.resolve(false);
  const existing = owner.operations.get(postId);
  if (existing) return existing;
  const before = savedPostState(owner.snapshot, postId);
  if (before === null) return Promise.resolve(false);
  if (before === saved) return Promise.resolve(true);
  const beforeCount = owner.snapshot.counts.get(postId);
  const request = Promise.resolve().then(async () => {
    if (!current(owner)) return false;
    try {
      if (saved) await addPostFavorite(postId); else await removePostFavorite(postId);
      if (!current(owner)) return false;
      record(owner, postId, saved);
      publish(owner, { revision: owner.snapshot.revision + 1 });
      return true;
    } catch (error) {
      if (!current(owner)) return false;
      record(owner, postId, before);
      const counts = new Map(owner.snapshot.counts);
      if (beforeCount !== undefined) counts.set(postId, beforeCount);
      publish(owner, { counts, errors: new Map(owner.snapshot.errors).set(postId,
        saved ? "posts.favorites.errors.addFailed" : "posts.favorites.errors.removeFailed") });
      throw error;
    } finally {
      owner.operations.delete(postId);
      if (current(owner)) {
        const pending = new Set(owner.snapshot.pending); pending.delete(postId);
        publish(owner, { pending });
      }
    }
  });
  owner.operations.set(postId, request);
  const pending = new Set(owner.snapshot.pending); pending.add(postId);
  const errors = new Map(owner.snapshot.errors); errors.delete(postId);
  const counts = new Map(owner.snapshot.counts);
  if (beforeCount !== undefined) counts.set(postId, Math.max(0, beforeCount + (saved ? 1 : -1)));
  publish(owner, { pending, errors, counts });
  record(owner, postId, saved);
  return request;
}
