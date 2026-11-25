import type { AuthenticatedAccount } from "@/lib/authenticated-account";
import { fetchHallSubscriptionStatus } from "@/services/hall-subscription";
import type { HallSubscription } from "@/types/hall-subscription";

// Share only pending reads within one continuous authenticated session.
// Settled responses are not cached, so later mounts and retries revalidate.
const pending = new WeakMap<AuthenticatedAccount, Map<string, Promise<HallSubscription>>>();

export function fetchScopedHallSubscription(account: AuthenticatedAccount, hallId: string) {
  let requests = pending.get(account);
  if (!requests) {
    requests = new Map();
    pending.set(account, requests);
  }
  const existing = requests.get(hallId);
  if (existing) return existing;
  const request = fetchHallSubscriptionStatus(hallId).finally(() => {
    if (requests.get(hallId) === request) requests.delete(hallId);
  });
  requests.set(hallId, request);
  return request;
}
