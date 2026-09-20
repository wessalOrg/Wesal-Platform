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

      {/* Physical right in both RTL (items-start) and LTR (items-end) */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-[92rem] flex-col items-start justify-start px-4 pb-8 pt-6 sm:min-h-[calc(100svh-4rem)] sm:px-6 sm:pt-8 ltr:items-end lg:justify-center lg:px-6 lg:pb-10 lg:pt-8 xl:px-10">
        <section className="w-full max-w-[32rem] -translate-y-1 sm:-translate-y-2 lg:-translate-y-5 xl:-translate-y-6 xl:max-w-[34rem]">
          {children}
        </section>
      </div>
    </div>
  );
}
