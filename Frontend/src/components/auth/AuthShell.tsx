"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import AuthMarketingPanel from "@/components/auth/AuthMarketingPanel";
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
      className="wesal-register-screen relative min-h-svh overflow-x-hidden font-sans subpixel-antialiased"
      data-auth-shell
      data-testid={testId}
    >
      <div
        className="wesal-register-bg absolute inset-0 bg-cover bg-center will-change-auto"
        style={{ backgroundImage: 'url("/auth/register-hero.jpg")' }}
        aria-hidden="true"
      />
      <div className="wesal-register-overlay absolute inset-0" aria-hidden="true" />

      <AuthMinimalHeader />

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-[92rem] flex-col justify-center px-4 py-6 sm:min-h-[calc(100svh-4rem)] sm:px-6 lg:px-6 lg:py-8 xl:px-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-10 rtl:lg:flex-row-reverse">
          <AuthMarketingPanel variant="desktop" />
          <section className="w-full shrink-0 lg:w-[min(100%,32rem)] lg:-translate-y-8 lg:translate-x-1 xl:w-[34rem] xl:-translate-y-10 xl:translate-x-3 rtl:lg:translate-x-2 rtl:xl:translate-x-5">
            {children}
          </section>
        </div>

        <AuthMarketingPanel variant="mobile" />
      </div>
    </div>
  );
}
