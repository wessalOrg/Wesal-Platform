"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  clearBookingHallContext,
  resolveAuthRedirect,
  setStoredAuth,
} from "@/lib/auth-storage";

type AuthStubFormProps = {
  mode: "login" | "register";
  redirectTo?: string;
  action?: string;
  alternateHref: string;
  alternateLabel: string;
};

export default function AuthStubForm({
  mode,
  redirectTo,
  action,
  alternateHref,
  alternateLabel,
}: AuthStubFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);

    setStoredAuth({
      token: `stub-${Date.now()}`,
      user: {
        id: "demo-user",
        name: mode === "login" ? "مستخدم وصال" : "عضو جديد",
        email: "demo@wesal.ps",
      },
    });

    const destination = resolveAuthRedirect(redirectTo, action);
    clearBookingHallContext();
    router.push(destination);
  };

  const title = mode === "login" ? "دخول سريع (تجريبي)" : "تسجيل سريع (تجريبي)";

  return (
    <div className="mt-8 max-w-md rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] p-5">
      <p className="text-sm font-semibold text-[var(--wesal-maroon)]">{title}</p>
      <p className="mt-1 text-xs leading-6 text-[var(--wesal-muted)]">
        حتى اكتمال Epic 4/5 — يحفظ جلسة تجريبية في المتصفح ويعيدك للقاعة.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--wesal-text)]">البريد الإلكتروني</span>
          <input
            type="email"
            defaultValue="demo@wesal.ps"
            className="w-full rounded-xl border border-[var(--wesal-border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--wesal-maroon)]"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--wesal-text)]">كلمة المرور</span>
          <input
            type="password"
            defaultValue="demo1234"
            className="w-full rounded-xl border border-[var(--wesal-border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--wesal-maroon)]"
          />
        </label>
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {mode === "login" ? "تسجيل الدخول والمتابعة" : "إنشاء حساب والمتابعة"}
        </button>
      </form>

      <Link
        href={alternateHref}
        className="mt-4 inline-flex text-sm font-semibold text-[var(--wesal-maroon)] hover:underline"
      >
        {alternateLabel}
      </Link>
    </div>
  );
}
