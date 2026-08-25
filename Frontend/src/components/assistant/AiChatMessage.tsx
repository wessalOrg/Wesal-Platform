"use client";

import AiAssistantSparkIcon from "@/components/assistant/AiAssistantSparkIcon";
import AiHallRecommendationList from "@/components/assistant/AiHallRecommendationList";
import WhatsAppActionLink from "@/components/assistant/WhatsAppActionLink";
import { useT } from "@/i18n";
import {
  chatTextDir,
  inferChatTextLang,
  type ChatTextLang,
} from "@/lib/ai-chat-text-direction";
import { mentionsWhatsApp, splitChatTextWithWhatsApp } from "@/lib/ai-chat-whatsapp";
import type { AiChatMessage } from "@/types/ai-chat";

function isI18nKey(value: string): boolean {
  return /^(assistant|errors)\.[a-zA-Z0-9.]+$/.test(value);
}

function BubbleCopy({
  text,
  linkWhatsApp,
  payment,
}: {
  text: string;
  linkWhatsApp: boolean;
  payment: boolean;
}) {
  if (!linkWhatsApp) return <>{text}</>;

  const segments = splitChatTextWithWhatsApp(text, {
    allowLocalMobile: payment || mentionsWhatsApp(text),
  });

  return (
    <>
      {segments.map((segment, index) =>
        segment.type === "whatsapp" ? (
          <WhatsAppActionLink key={`wa-${index}-${segment.href}`} href={segment.href}>
            {segment.label}
          </WhatsAppActionLink>
        ) : (
          <span key={`text-${index}`}>{segment.value}</span>
        ),
      )}
    </>
  );
}

function bubbleLang(message: AiChatMessage, displayed: string): ChatTextLang {
  if (!isI18nKey(message.text) && message.lang) return message.lang;
  return inferChatTextLang(displayed);
}

type AiChatMessageProps = {
  message: AiChatMessage;
};

/** One bubble in the thread. Presentation only. */
export default function AiChatMessageBubble({ message }: AiChatMessageProps) {
  const t = useT();
  const isUser = message.role === "user";
  const body = isI18nKey(message.text) ? t(message.text) : message.text;
  const lang = bubbleLang(message, body);
  const dir = chatTextDir(lang);

  return (
    <article
      className={`flex min-w-0 ${isUser ? "justify-end" : "justify-start"}`}
      data-testid="ai-chat-message"
      data-role={message.role}
      data-variant={message.variant}
      data-dir={dir}
    >
      <div className={`min-w-0 max-w-[92%] ${isUser ? "ms-8" : "me-6"}`}>
        {isUser ? null : (
          <p className="mb-1.5 flex items-center gap-1.5 text-[0.68rem] text-[var(--wesal-muted)]">
            <AiAssistantSparkIcon className="h-3 w-3 text-[var(--wesal-maroon)]" />
            {t("assistant.senderLabel")}
          </p>
        )}
        <div
          className={
            isUser
              ? "wesal-ai-bubble-user rounded-2xl rounded-ee-md px-3.5 py-2.5 text-[0.82rem] leading-6 text-white"
              : message.variant === "error"
                ? "rounded-2xl rounded-es-md border border-[var(--wesal-border)] bg-[#fbf4f2] px-3.5 py-2.5 text-[0.82rem] leading-6 text-[var(--wesal-text)]"
                : message.variant === "fallback" || message.variant === "help"
                  ? "rounded-2xl rounded-es-md border border-dashed border-[var(--wesal-maroon-soft)] bg-white px-3.5 py-2.5 text-[0.82rem] leading-6 text-[var(--wesal-text)]"
                  : "rounded-2xl rounded-es-md border border-[var(--wesal-border)] bg-white px-3.5 py-2.5 text-[0.82rem] leading-6 text-[var(--wesal-text)]"
          }
        >
          <div
            dir={dir}
            lang={lang}
            className="wesal-ai-bubble-copy"
          >
            <BubbleCopy
              text={body}
              linkWhatsApp={!isUser}
              payment={message.category === "payment"}
            />
          </div>
        </div>
        {isUser ? null : (
          <AiHallRecommendationList
            halls={message.halls}
            status={message.recommendationStatus}
            criteria={message.criteria}
          />
        )}
      </div>
    </article>
  );
}
