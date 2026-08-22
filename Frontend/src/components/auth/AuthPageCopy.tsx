"use client";

import AuthStubForm from "@/components/auth/AuthStubForm";
import { useT } from "@/i18n";

type AuthPageCopyProps = {
  mode: "login" | "register";
  redirect?: string;
  action?: string;
  alternateHref: string;
};

export default function AuthPageCopy({
  mode,
  redirect,
  action,
  alternateHref,
}: AuthPageCopyProps) {
  const t = useT();

  const actionSuffix =
    action === "book"
      ? t("auth.redirect.book")
      : action === "contact"
        ? t("auth.redirect.contact")
        : "";

  const title = mode === "login" ? t("auth.login.title") : t("auth.register.title");
  const redirectBase =
    mode === "login" ? t("auth.redirect.base") : t("auth.redirect.registerBase");
  const defaultCopy =
    mode === "login" ? t("auth.login.default") : t("auth.register.default");
  const alternateLabel =
    mode === "login" ? t("auth.alternate.register") : t("auth.alternate.login");

  return (
    <>
      <h1 className="text-3xl font-bold text-[var(--wesal-maroon)]">{title}</h1>
      <p className="mt-3 text-[var(--wesal-muted)]">
        {redirect ? (
          <>
            {redirectBase}
            {actionSuffix}.
            <span className="mt-1 block text-sm text-[var(--wesal-text)]">
              {decodeURIComponent(redirect)}
            </span>
          </>
        ) : (
          defaultCopy
        )}
      </p>
      <AuthStubForm
        mode={mode}
        redirectTo={redirect}
        action={action}
        alternateHref={alternateHref}
        alternateLabel={alternateLabel}
      />
    </>
  );
}
