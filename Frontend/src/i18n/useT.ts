"use client";

import { useCallback, useMemo } from "react";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { translate } from "@/i18n/translate";
import type { MessageParams, TranslateFn } from "@/i18n/types";

/** Hook: `const t = useT(); t("nav.home")` with Arabic fallback. */
export function useT(): TranslateFn {
  const lang = useUiLang();

  return useCallback(
    (key: string, params?: MessageParams) => translate(key, lang, params),
    [lang],
  );
}

export function useTranslateLang() {
  const lang = useUiLang();
  const t = useT();
  return useMemo(() => ({ lang, t }), [lang, t]);
}
