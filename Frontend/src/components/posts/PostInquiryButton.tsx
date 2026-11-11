"use client";

import { useStartContentConversation } from "@/hooks/useStartContentConversation";
import { useT } from "@/i18n";

type PostInquiryButtonProps = {
  kind: "post" | "offer";
  contentId: string;
  className?: string;
  variant?: "primary" | "outline";
};

export default function PostInquiryButton({
  kind,
  contentId,
  className = "",
  variant = "primary",
}: PostInquiryButtonProps) {
  const t = useT();
  const { start, starting, error } = useStartContentConversation();

  return (
    <div className={className}>
      <button
        type="button"
        className={`inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm font-bold sm:w-auto ${
          variant === "primary" ? "btn-primary" : "btn-outline"
        }`}
        disabled={starting || !contentId}
        onClick={() => {
          void start(kind, contentId);
        }}
        data-testid={`${kind}-inquiry-button`}
      >
        <ChatIcon />
        {starting
          ? t("posts.inquiry.starting")
          : kind === "offer"
            ? t("posts.inquiry.offer")
            : t("posts.inquiry.post")}
      </button>
      {error ? (
        <p className="mt-2 text-xs text-[#b42318]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8l-5 3V7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
