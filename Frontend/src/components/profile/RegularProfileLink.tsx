"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, type ReactNode } from "react";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import {
  getAccountProfilePath,
  REGULAR_PROFILE_PATH,
} from "@/lib/account-profile-path";

type RegularProfileLinkProps = {
  children: ReactNode;
  className?: string;
  title?: string;
  "aria-label"?: string;
  "data-testid"?: string;
};

/**
 * Navigates to the role-aware Profile destination after auth checks.
 * Hall Owners go to the management interface; Regular Users keep `/profile`.
 */
export default function RegularProfileLink({
  children,
  className,
  title,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: RegularProfileLinkProps) {
  const router = useRouter();
  const { ready, authenticated, role } = useUserIdentity();

  const href = authenticated
    ? getAccountProfilePath(role)
    : `/login?redirect=${encodeURIComponent(REGULAR_PROFILE_PATH)}`;

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!ready) {
      event.preventDefault();
      return;
    }

    if (!authenticated) {
      event.preventDefault();
      router.push(`/login?redirect=${encodeURIComponent(REGULAR_PROFILE_PATH)}`);
    }
  };

  return (
    <Link
      href={href}
      className={className}
      title={title}
      aria-label={ariaLabel}
      data-testid={testId}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
