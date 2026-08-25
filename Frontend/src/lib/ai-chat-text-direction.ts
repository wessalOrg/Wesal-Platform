export type ChatTextLang = "ar" | "en";
export type ChatTextDir = "rtl" | "ltr";

const ARABIC_LETTER = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN_LETTER = /[A-Za-z\u00C0-\u024F]/;

/**
 * Maps `responseLanguage` from how-to / recommend payloads. Unknown values
 * return null so the bubble can infer from the visible text instead.
 */
export function parseChatResponseLanguage(value: unknown): ChatTextLang | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/[_-]/g, "");
  if (!normalized) return null;
  if (normalized === "ar" || normalized === "arabic") return "ar";
  if (normalized.startsWith("ar") && normalized.length <= 5) return "ar";
  if (normalized === "en" || normalized === "english") return "en";
  if (normalized.startsWith("en") && normalized.length <= 5) return "en";
  return null;
}

function firstStrongLang(text: string): ChatTextLang | null {
  for (const char of text) {
    if (ARABIC_LETTER.test(char)) return "ar";
    if (LATIN_LETTER.test(char)) return "en";
  }
  return null;
}

/** Infer ar/en from the characters in a single bubble. Does not read UI language. */
export function inferChatTextLang(text: string): ChatTextLang {
  let arabic = 0;
  let latin = 0;
  for (const char of text) {
    if (ARABIC_LETTER.test(char)) arabic += 1;
    else if (LATIN_LETTER.test(char)) latin += 1;
  }
  if (arabic === 0 && latin === 0) return firstStrongLang(text) ?? "ar";
  if (arabic > latin) return "ar";
  if (latin > arabic) return "en";
  return firstStrongLang(text) ?? "ar";
}

export function chatTextDir(lang: ChatTextLang): ChatTextDir {
  return lang === "en" ? "ltr" : "rtl";
}

export function resolveChatTextLang(
  text: string,
  responseLanguage?: string | null,
): ChatTextLang {
  return parseChatResponseLanguage(responseLanguage) ?? inferChatTextLang(text);
}
