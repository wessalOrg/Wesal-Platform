"use client";

import dynamic from "next/dynamic";
import { useAdminOwnerMessage } from "@/components/admin/halls/AdminOwnerMessageProvider";
import MessagesErrorBoundary from "@/components/messages/MessagesErrorBoundary";
import { useT } from "@/i18n";

const AdminOwnerMessagePanel = dynamic(() => import("./AdminOwnerMessagePanel"), {
  ssr: false,
});

/** Floating fallback so a crash inside the panel never takes down the admin page. */
function PanelCrashCard({ retry, close }: { retry: () => void; close: () => void }) {
  const t = useT();
  return (
    <div
      className="fixed bottom-3 start-3 z-[200] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-[var(--wesal-maroon)]/25 bg-[var(--wesal-pink)] p-4 text-center shadow-[0_18px_44px_rgba(90,55,45,0.22)]"
      role="alert"
      data-testid="admin-owner-message-crash"
    >
      <p className="text-sm leading-7 text-[var(--wesal-muted)]">{t("messages.crashRecover")}</p>
      <div className="mt-3 flex items-center justify-center gap-2">
        <button type="button" className="btn-outline" onClick={retry}>
          {t("common.retry")}
        </button>
        <button type="button" className="btn-outline" onClick={close}>
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}

export default function AdminOwnerMessagePanelHost() {
  const { target, close } = useAdminOwnerMessage();
  if (!target) return null;
  return (
    <MessagesErrorBoundary
      key={`${target.hallId}`}
      fallback={(retry) => <PanelCrashCard retry={retry} close={close} />}
    >
      <AdminOwnerMessagePanel />
    </MessagesErrorBoundary>
  );
}
