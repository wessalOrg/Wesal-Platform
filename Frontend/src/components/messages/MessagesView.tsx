"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { useT } from "@/i18n";
import {
  conversationErrorMessage,
  fetchConversation,
  type ConversationThread,
} from "@/services/conversations";
import { ApiError } from "@/lib/api-error";

type MessagesViewProps = {
  conversationId: string;
};

type LoadStatus = "loading" | "ready" | "unauthorized" | "error";

export default function MessagesView({ conversationId }: MessagesViewProps) {
  const t = useT();
  const { session, status: authStatus } = useAuth();
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [thread, setThread] = useState<ConversationThread | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session.isAuthenticated) {
      setStatus("unauthorized");
      return;
    }

    let active = true;
    setStatus("loading");
    void fetchConversation(conversationId)
      .then((next) => {
        if (!active) return;
        setThread(next);
        setStatus("ready");
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) {
          setStatus("unauthorized");
          return;
        }
        setMessage(conversationErrorMessage(err));
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [authStatus, conversationId, session.isAuthenticated]);

  if (status === "unauthorized") {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(90,55,45,0.08)]" data-testid="messages-unauthorized">
        <h1 className="text-2xl font-bold text-[var(--wesal-maroon)]">{t("messages.title")}</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--wesal-muted)]">
          {t("messages.loginRequired")}
        </p>
        <Link href={`/login?redirect=/messages/${conversationId}`} className="btn-primary mt-5">
          {t("messages.goLogin")}
        </Link>
      </section>
    );
  }

  if (status === "loading") {
    return (
      <div
        className="h-64 animate-pulse rounded-2xl bg-white"
        aria-busy="true"
        data-testid="messages-loading"
      />
    );
  }

  if (status === "error" || !thread) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(90,55,45,0.08)]" data-testid="messages-error">
        <h1 className="text-2xl font-bold text-[var(--wesal-maroon)]">{t("messages.error")}</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--wesal-muted)]">
          {message ?? t("messages.error")}
        </p>
        <Link href="/halls" className="btn-outline mt-5">
          {t("common.backToHalls")}
        </Link>
      </section>
    );
  }

  return (
    <section
      className="flex min-h-[60svh] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_12px_30px_rgba(90,55,45,0.08)]"
      data-testid="messages-thread"
    >
      <header className="border-b border-[var(--wesal-border)] px-5 py-4">
        <p className="text-xs font-semibold text-[var(--wesal-gold)]">{t("messages.title")}</p>
        <h1 className="mt-1 text-xl font-bold text-[var(--wesal-maroon)]">{thread.hallName}</h1>
      </header>
      <div className="flex flex-1 items-center justify-center px-5 py-10 text-center">
        <p className="max-w-md text-sm leading-8 text-[var(--wesal-muted)]">
          {t("messages.placeholder")}
        </p>
      </div>
      <form
        className="border-t border-[var(--wesal-border)] p-4"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="sr-only" htmlFor="message-draft">
          {t("messages.composerDisabled")}
        </label>
        <div className="flex gap-2">
          <input
            id="message-draft"
            type="text"
            disabled
            placeholder={t("messages.composerDisabled")}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--wesal-border)] bg-[#faf7f4] px-3 text-sm"
          />
          <button type="submit" className="btn-primary shrink-0" disabled>
            {t("messages.send")}
          </button>
        </div>
      </form>
    </section>
  );
}
