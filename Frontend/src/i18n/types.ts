import type { UiLang } from "@/lib/language";

export type MessageParams = Record<string, string | number>;

/** Flat key → Arabic string. English may omit keys (Arabic fallback). */
export type MessageCatalog = Record<string, string>;

export type TranslateFn = (key: string, params?: MessageParams) => string;

export type { UiLang };
