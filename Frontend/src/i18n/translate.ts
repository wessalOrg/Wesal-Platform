import ar from "@/i18n/messages/ar";
import en from "@/i18n/messages/en";
import type { MessageParams, UiLang } from "@/i18n/types";
import { DEFAULT_UI_LANG, getStoredUiLang, isUiLang } from "@/lib/language";

const catalogs = {
  ar,
  en,
} as const;

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value == null ? `{${key}}` : String(value);
  });
}

/**
 * Resolve a message key for the active language.
 * Missing English keys fall back to Arabic (never returns the raw key).
 */
export function translate(
  key: string,
  lang: UiLang = DEFAULT_UI_LANG,
  params?: MessageParams,
): string {
  const primary = catalogs[lang]?.[key];
  const fallback = catalogs.ar[key];
  const template =
    (primary && primary.trim() !== "" ? primary : null) ??
    (fallback && fallback.trim() !== "" ? fallback : null) ??
    "";

  return interpolate(template, params);
}

/** Browser helper — uses stored language (defaults to Arabic). */
export function t(key: string, params?: MessageParams): string {
  if (typeof window === "undefined") {
    return translate(key, DEFAULT_UI_LANG, params);
  }
  return translate(key, getStoredUiLang(), params);
}

export function resolveUiLang(value?: string | null): UiLang {
  return isUiLang(value) ? value : DEFAULT_UI_LANG;
}

export { catalogs };
