import api from "@/lib/api";
import { isUiLang, type UiLang } from "@/lib/language";

type LanguageResponse = {
  language?: string;
};

function normalizeLanguage(payload: LanguageResponse | string | null | undefined): UiLang | null {
  const code =
    typeof payload === "string"
      ? payload
      : typeof payload?.language === "string"
        ? payload.language
        : null;
  if (!code) return null;
  const normalized = code.trim().toLowerCase();
  return isUiLang(normalized) ? normalized : null;
}

/** GET /v1/language — authenticated preference (401 → null). */
export async function fetchLanguagePreference(): Promise<UiLang | null> {
  try {
    const { data } = await api.get<LanguageResponse>("/language", {
      timeout: 4000,
    });
    return normalizeLanguage(data);
  } catch {
    return null;
  }
}

/** PUT /v1/language — persists preference for the logged-in user. */
export async function updateLanguagePreference(lang: UiLang): Promise<UiLang | null> {
  try {
    const { data } = await api.put<LanguageResponse>(
      "/language",
      { language: lang },
      { timeout: 4000 },
    );
    return normalizeLanguage(data) ?? lang;
  } catch {
    return null;
  }
}
