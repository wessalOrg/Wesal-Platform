"use client";

import { useCallback, useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import {
  isCurrentAuthenticatedAccount, readAuthenticatedAccount,
  serverAuthenticatedAccount, subscribeAuthenticatedAccount,
} from "@/lib/authenticated-account";
import { createRequestScope } from "@/lib/request-scope";

/** One continuous login and request configuration own all callbacks in this scope. */
export function useAuthenticatedRequestScope(enabled = true, requestKey = "") {
  const account = useSyncExternalStore(
    subscribeAuthenticatedAccount, readAuthenticatedAccount, serverAuthenticatedAccount,
  );
  const scope = useMemo(() => ({
    account, enabled, requestKey, ...createRequestScope(),
  }), [account, enabled, requestKey]);
  useLayoutEffect(() => {
    scope.activate();
    return () => scope.dispose();
  }, [scope]);
  const isCurrent = useCallback(() =>
    scope.enabled && scope.isActive() && isCurrentAuthenticatedAccount(scope.account), [scope]);
  return { account, scope, isCurrent };
}
