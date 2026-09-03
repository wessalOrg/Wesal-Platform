"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, type ReactNode } from "react";
import { useUserIdentity } from "@/hooks/useUserIdentity";

const PROFILE_HREF = "/profile";
const LOGIN_HREF = "/login?redirect=/profile";

type RegularProfileLinkProps = {
  children: ReactNode;
  className?: string;
  title?: string;
  "aria-label"?: string;
  "data-testid"?: string;
};

/**
 * Navigates to the Regular User profile only after auth + role checks.
 * Hall Owners are never sent here.
 */
export default function RegularProfileLink({
  children,
  className,
  title,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: RegularProfileLinkProps) {
  const router = useRouter();
  const { ready, authenticated, canOpenRegularProfile } = useUserIdentity();

  const href = authenticated && canOpenRegularProfile ? PROFILE_HREF : LOGIN_HREF;

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!ready) {
      event.preventDefault();
      return;
    }

    if (!authenticated) {
      event.preventDefault();
      router.push(LOGIN_HREF);
      return;
    }

    if (!canOpenRegularProfile) {
      event.preventDefault();
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
