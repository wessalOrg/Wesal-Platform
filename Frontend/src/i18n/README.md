# Frontend i18n

- Dictionaries: `messages/ar.ts` (canonical) and `messages/en.ts`
- Client UI: `const t = useT(); t("nav.home")`
- Services / non-React: `import { t } from "@/i18n"`
- Missing English keys fall back to Arabic automatically
- Default language is Arabic; never show raw keys to users

New user-facing copy must go through this system — do not hardcode Arabic/English in components.
