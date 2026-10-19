export type SiteTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "wesal_theme";

const THEME_COLORS: Record<SiteTheme, string> = {
  light: "#c17b7f",
  dark: "#171311",
};

export function applyDocumentTheme(theme: SiteTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[theme]);
}

export function toggleDocumentTheme(): void {
  const next: SiteTheme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyDocumentTheme(next);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Ignore quota / private mode failures.
  }
}

/** Inline boot script — runs before paint so the saved theme does not flash. */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t!=="dark")t="light";document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;
