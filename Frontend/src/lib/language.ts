export type UiLang = "ar" | "en";

export const DEFAULT_UI_LANG: UiLang = "ar";
export const UI_LANG_STORAGE_KEY = "wesal_ui_lang";
export const UI_LANG_CHANGE_EVENT = "wesal-lang-change";

export function isUiLang(value: unknown): value is UiLang {
  return value === "ar" || value === "en";
}

export function langToDir(lang: UiLang): "rtl" | "ltr" {
  return lang === "en" ? "ltr" : "rtl";
}

export function getStoredUiLang(): UiLang {
  if (typeof window === "undefined") return DEFAULT_UI_LANG;
  try {
    const raw = window.localStorage.getItem(UI_LANG_STORAGE_KEY);
    return isUiLang(raw) ? raw : DEFAULT_UI_LANG;
  } catch {
    return DEFAULT_UI_LANG;
  }
}

export function setStoredUiLang(lang: UiLang): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UI_LANG_STORAGE_KEY, lang);
  } catch {
    // Ignore quota / private mode failures.
  }
}

export function applyDocumentLanguage(lang: UiLang): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = langToDir(lang);
}

export function notifyUiLangChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(UI_LANG_CHANGE_EVENT));
}

/** Inline boot script — runs before paint to avoid RTL/LTR flash. */
export const LANGUAGE_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(UI_LANG_STORAGE_KEY)};var l=localStorage.getItem(k);if(l!=="en"&&l!=="ar")l=${JSON.stringify(DEFAULT_UI_LANG)};document.documentElement.lang=l;document.documentElement.dir=l==="en"?"ltr":"rtl";}catch(e){}})();`;
