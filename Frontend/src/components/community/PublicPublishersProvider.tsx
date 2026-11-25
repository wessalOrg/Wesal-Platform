"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { readAuthenticatedAccount, serverAuthenticatedAccount, subscribeAuthenticatedAccount, type AuthenticatedAccount } from "@/lib/authenticated-account";
import { fetchPublicProfessionalProfile } from "@/services/professional-profile";
import type { PublicProfessionalProfile } from "@/types/professional-profile";

type LoadPublisher = (userId: string) => Promise<PublicProfessionalProfile>;
const PublishersContext = createContext<LoadPublisher | null>(null);

function createPublisherCache(account: AuthenticatedAccount | null) {
  const requests = new Map<string, Promise<PublicProfessionalProfile>>();
  return { account, load(userId: string) {
    let request = requests.get(userId);
    if (!request) { request = fetchPublicProfessionalProfile(userId); requests.set(userId, request); }
    return request;
  } };
}

/** One public-profile request per publisher across both sections, for this page/session. */
export default function PublicPublishersProvider({ children }: { children: ReactNode }) {
  const account = useSyncExternalStore(subscribeAuthenticatedAccount, readAuthenticatedAccount, serverAuthenticatedAccount);
  const cache = useMemo(() => createPublisherCache(account), [account]);
  return <PublishersContext.Provider value={cache.load}>{children}</PublishersContext.Provider>;
}

export function usePublicPublisher(userId: string | null) {
  const load = useContext(PublishersContext);
  const request = useMemo(() => ({ userId, load }), [load, userId]);
  const [result, setResult] = useState<{ request: typeof request; profile: PublicProfessionalProfile | null } | null>(null);
  useEffect(() => {
    if (!request.userId || !request.load) return;
    let active = true;
    void request.load(request.userId).then(profile => {
      if (active) setResult({ request, profile });
    }).catch(() => { if (active) setResult({ request, profile: null }); });
    return () => { active = false; };
  }, [request]);
  return { profile: result?.request === request ? result.profile : null,
    loading: Boolean(userId && load && result?.request !== request) };
}
