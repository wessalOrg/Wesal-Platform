"use client";

import { useRouter } from "next/navigation";
import { BackHomeArrow } from "@/components/layout/ComingSoonPage";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";

type MessagesBackButtonProps = {
  /** Where to go when there is no previous page in this tab (e.g. the chat was opened directly). */
  fallbackHref: string;
};

/**
 * Round arrow button (same look as the About page one). Returns to the page the user came
 * from, e.g. the hall details they contacted from. The label only appears on hover / focus.
 */
export default function MessagesBackButton({ fallbackHref }: MessagesBackButtonProps) {
  const t = useT();
  const lang = useUiLang();
  const router = useRouter();
  const label = t("messages.backToPreviousPage");

  return (
    <div className="group relative mb-3 inline-block">
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => {
          if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
          } else {
            router.push(fallbackHref);
          }
        }}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--wesal-gold)] text-[var(--wesal-maroon-dark)] transition-colors hover:bg-[var(--wesal-gold)] hover:text-white focus-visible:bg-[var(--wesal-gold)] focus-visible:text-white"
        data-testid="messages-back-previous"
      >
        <BackHomeArrow flip={lang === "en"} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute start-0 top-full z-10 mt-2 whitespace-nowrap rounded-full bg-[var(--wesal-maroon-dark)] px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-[0_6px_16px_rgba(90,55,45,0.2)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </div>
  );
}
