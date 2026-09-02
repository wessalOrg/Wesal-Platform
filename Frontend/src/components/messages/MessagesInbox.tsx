"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useT } from "@/i18n";
import { ApiError } from "@/lib/api-error";
import {
  conversationErrorMessage,
  fetchMyConversations,
  type ConversationSummary,
} from "@/services/conversations";

type FetchStatus = "idle" | "loading" | "ready" | "error";

export default function MessagesInbox() {
  const t = useT();
  const { session, status: authStatus } = useAuth();
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const isGuest = authStatus === "ready" && !session.isAuthenticated;
  const canFetch = authStatus === "ready" && session.isAuthenticated;

  useEffect(() => {
    if (!canFetch) return;

    let active = true;
    queueMicrotask(() => {
      if (active) setFetchStatus("loading");
    });

    void fetchMyConversations()
      .then((next) => {
        if (!active) return;
        setItems(next.filter((item) => item.conversationId));
        setFetchStatus("ready");
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) {
          setFetchStatus("idle");
          return;
        }
        setMessage(conversationErrorMessage(err));
        setFetchStatus("error");
      });

    return () => {
      active = false;
    };
  }, [canFetch]);

  if (isGuest) {
    return (
      <section
        className="rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(90,55,45,0.08)]"
        data-testid="messages-inbox-unauthorized"
      >
        <h1 className="text-2xl font-bold text-[var(--wesal-maroon)]">{t("messages.inboxTitle")}</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--wesal-muted)]">
          {t("messages.loginRequired")}
        </p>
        <Link href="/login?redirect=/messages" className="btn-primary mt-5">
          {t("messages.goLogin")}
        </Link>
      </section>
    );
  }

  if (authStatus === "loading" || fetchStatus === "idle" || fetchStatus === "loading") {
    return (
      <div
        className="h-64 animate-pulse rounded-2xl bg-white"
        aria-busy="true"
        data-testid="messages-inbox-loading"
      />
    );
  }

  if (fetchStatus === "error") {
    return (
      <section
        className="rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(90,55,45,0.08)]"
        data-testid="messages-inbox-error"
      >
        <h1 className="text-2xl font-bold text-[var(--wesal-maroon)]">{t("messages.inboxError")}</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--wesal-muted)]">
          {message ?? t("messages.inboxError")}
        </p>
        <Link href="/halls" className="btn-outline mt-5">
          {t("common.backToHalls")}
        </Link>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(90,55,45,0.08)]"
      data-testid="messages-inbox"
    >
      <h1 className="text-2xl font-bold text-[var(--wesal-maroon)]">{t("messages.inboxTitle")}</h1>
      <p className="mt-2 text-sm leading-7 text-[var(--wesal-muted)]">{t("messages.inboxSubtitle")}</p>

      {items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-[var(--wesal-border)] px-4 py-8 text-center">
          <p className="text-sm text-[var(--wesal-muted)]">{t("messages.inboxEmpty")}</p>
          <Link href="/halls" className="btn-primary mt-5 inline-flex min-h-11">
            {t("common.backToHalls")}
          </Link>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-[var(--wesal-border)]">
          {items.map((item) => (
            <li key={item.conversationId}>
              <Link
                href={`/messages/${item.conversationId}`}
                className="flex flex-col gap-1 py-4 transition hover:text-[var(--wesal-maroon)]"
              >
                <span className="font-semibold text-[var(--wesal-text)]">{item.hallName}</span>
                <span className="text-sm text-[var(--wesal-muted)]">
                  {item.lastMessagePreview || item.otherParticipantName}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
