"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import AuthMinimalHeader from "@/components/auth/AuthMinimalHeader";
import { consumeAuthNavigation } from "@/lib/auth-nav";

type AuthShellProps = {
  children: ReactNode;
  testId?: string;
};

export default function AuthShell({ children, testId = "auth-shell" }: AuthShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-auth-shell]");
    if (!root) return;
    if (consumeAuthNavigation()) root.dataset.authInstant = "true";
    else delete root.dataset.authInstant;
  }, [pathname]);

  useEffect(() => {
    router.prefetch("/login");
    router.prefetch("/register");
  }, [router]);

  return (
    <div
      className="wesal-register-screen relative min-h-svh overflow-hidden font-sans subpixel-antialiased"
      data-auth-shell
      data-testid={testId}
    >
      <div
        key={pathname}
        className="wesal-register-bg absolute bg-cover bg-center"
        style={{ backgroundImage: 'url("/auth/register-hero.jpg")' }}
        aria-hidden="true"
      />
      <div className="wesal-register-overlay absolute inset-0" aria-hidden="true" />

      <AuthMinimalHeader />

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-[92rem] flex-col items-center justify-center px-4 pb-8 pt-4 sm:min-h-[calc(100svh-4rem)] sm:px-6 sm:pt-6 lg:px-6 lg:pb-10 xl:px-10">
        <section className="w-full max-w-[32rem] xl:max-w-[34rem]">{children}</section>
      </div>
    </div>
  );
}
