"use client";

import { Fragment, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import {
  ADMIN_MANAGEMENT_PATH, HALL_OWNER_MANAGEMENT_PATH,
  PROFESSIONAL_OFFERS_MANAGE_PATH, REGULAR_PROFILE_PATH,
} from "@/lib/account-profile-path";
import { readAuthenticatedAccount, serverAuthenticatedAccount, subscribeAuthenticatedAccount } from "@/lib/authenticated-account";

/** Route access depends on the role; approval and publishing locks stay in the workspace. */
export default function ProfessionalOffersRouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { ready, authenticated, isProfessional, isAdmin, isHallOwner, userId } = useAccountAccess();
  const account = useSyncExternalStore(subscribeAuthenticatedAccount, readAuthenticatedAccount, serverAuthenticatedAccount);
  const [context, setContext] = useState({ account, userId, revision: 0 });
  if (context.account !== account || context.userId !== userId) {
    // Reset only for a different login/owner, never for a permission/profile refresh.
    setContext({ account, userId, revision: context.revision + 1 });
  }
  const allowed = ready && authenticated && isProfessional;

  useEffect(() => {
    if (!ready || allowed) return;
    const destination = !authenticated
      ? `/login?redirect=${encodeURIComponent(PROFESSIONAL_OFFERS_MANAGE_PATH)}`
      : isAdmin ? ADMIN_MANAGEMENT_PATH
        : isHallOwner ? HALL_OWNER_MANAGEMENT_PATH : REGULAR_PROFILE_PATH;
    router.replace(destination);
  }, [ready, allowed, authenticated, isAdmin, isHallOwner, router]);

  if (!allowed) {
    return (
      <div className="seeker-app-guard">
        <div className="h-72 max-w-xl animate-pulse rounded-2xl bg-white shadow-[0_12px_30px_rgba(90,55,45,0.08)]"
          aria-busy="true" data-testid={ready ? "professional-offers-redirect" : "professional-offers-loading"} />
      </div>
    );
  }
  return <Fragment key={context.revision}>{children}</Fragment>;
}
