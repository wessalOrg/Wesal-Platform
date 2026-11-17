"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  applyDocumentLanguage,
  DEFAULT_UI_LANG,
  getStoredUiLang,
  notifyUiLangChange,
  setStoredUiLang,
  type UiLang,
} from "@/lib/language";
import {
  fetchLanguagePreference,
  updateLanguagePreference,
} from "@/services/language";

type LanguageContextValue = {
  lang: UiLang;
  status: "loading" | "ready";
  setLanguage: (next: UiLang) => Promise<void>;
  toggleLanguage: () => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { session, status: authStatus } = useAuth();
  const [lang, setLang] = useState<UiLang>(DEFAULT_UI_LANG);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  const applyLanguage = useCallback((next: UiLang) => {
    setLang(next);
    setStoredUiLang(next);
    applyDocumentLanguage(next);
    notifyUiLangChange();
  }, []);

  useEffect(() => {
    const stored = getStoredUiLang();
    applyLanguage(stored);
    setStatus("ready");
  }, [applyLanguage]);

  useEffect(() => {
    if (authStatus !== "ready" || !session.isAuthenticated) return;

    let active = true;

    void (async () => {
      const preferred = await fetchLanguagePreference();
      if (!active || !preferred) return;
      if (preferred === getStoredUiLang()) return;
      applyLanguage(preferred);
    })();

    return () => {
      active = false;
    };
  }, [authStatus, session.isAuthenticated, applyLanguage]);

  const setLanguage = useCallback(
    async (next: UiLang) => {
      applyLanguage(next);
      if (session.isAuthenticated) {
        await updateLanguagePreference(next);
      }
    },
    [applyLanguage, session.isAuthenticated],
  );

  const toggleLanguage = useCallback(async () => {
    await setLanguage(lang === "ar" ? "en" : "ar");
  }, [lang, setLanguage]);

  const value = useMemo(
    () => ({ lang, status, setLanguage, toggleLanguage }),
    [lang, status, setLanguage, toggleLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      lang: DEFAULT_UI_LANG,
      status: "ready",
      setLanguage: async () => undefined,
      toggleLanguage: async () => undefined,
    };
  }
  return context;
}

/** Compatibility hook used by Navbar and other UI copy. */
export function useUiLang(): UiLang {
  return useLanguage().lang;
}
