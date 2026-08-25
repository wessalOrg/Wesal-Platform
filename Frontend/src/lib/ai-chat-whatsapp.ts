export type ChatWhatsAppSegment =
  | { type: "text"; value: string }
  | { type: "whatsapp"; href: string; label: string };

const WA_HOSTS = new Set(["wa.me", "api.whatsapp.com", "web.whatsapp.com"]);
const MAX_PREFILL_CHARS = 300;

const MARKDOWN_WA_RE =
  /\[([^\]]{1,80})\]\((https?:\/\/(?:www\.)?(?:wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)[^)\s]*)\)/gi;

const WA_URL_RE =
  /https?:\/\/(?:www\.)?(?:wa\.me\/[^\s<>)'"\]]+|api\.whatsapp\.com\/send\/?[^\s<>)'"\]]*|web\.whatsapp\.com\/send\/?[^\s<>)'"\]]*)/gi;

const BARE_WA_ME_RE =
  /(?<![A-Za-z0-9./])(?:www\.)?wa\.me\/\+?[\d\u0660-\u0669\u06F0-\u06F9]{8,15}(?:\?[^\s<>)'"]*)?/gi;

const INTL_PHONE_RE =
  /(?:\+|00)(?:[\s-]*[\d\u0660-\u0669\u06F0-\u06F9]){8,15}/g;

const LOCAL_MOBILE_RE =
  /(?<![\dA-Za-z+])0?5[\d\u0660-\u0669\u06F0-\u06F9](?:[\s-]*[\d\u0660-\u0669\u06F0-\u06F9]){7,8}(?![\d\u0660-\u0669\u06F0-\u06F9])/g;

const TRAILING_PUNCT_RE = /[.,;:!?،؛)\]}>]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COMPACT_DATE_RE = /^(19|20)\d{6}$/;

function toAsciiDigits(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0));
}

function normalizePhoneDigits(raw: string): string | null {
  let digits = toAsciiDigits(raw).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length < 8 || digits.length > 15) return null;
  if (COMPACT_DATE_RE.test(digits)) return null;
  return digits;
}

function stripTrailingPunctuation(value: string): { core: string; trailing: string } {
  const punct = value.match(TRAILING_PUNCT_RE)?.[0] ?? "";
  if (!punct) return { core: value, trailing: "" };
  return { core: value.slice(0, -punct.length), trailing: punct };
}

function displayLabel(raw: string, digits: string, markdownLabel?: string): string {
  const named = markdownLabel?.trim();
  if (named) return named;
  if (/^https?:/i.test(raw) || /wa\.me/i.test(raw) || /whatsapp\.com/i.test(raw)) {
    return `+${digits}`;
  }
  return raw.trim();
}

function digitsFromHref(href: string): string | null {
  try {
    return normalizePhoneDigits(new URL(href).pathname.replace(/^\//, ""));
  } catch {
    return null;
  }
}

/**
 * Accepts a WhatsApp URL or a raw phone string and returns a canonical
 * `https://wa.me/<digits>` href, or null when the value is not a safe WhatsApp target.
 */
export function sanitizeWhatsAppHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500) return null;

  const looksLikeUrl =
    /^https?:/i.test(trimmed) || /wa\.me/i.test(trimmed) || /whatsapp\.com/i.test(trimmed);

  if (!looksLikeUrl) {
    if (ISO_DATE_RE.test(trimmed)) return null;
    const digits = normalizePhoneDigits(trimmed);
    return digits ? `https://wa.me/${digits}` : null;
  }

  let url: URL;
  try {
    url = new URL(/^https?:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (!WA_HOSTS.has(host)) return null;

  let digits: string | null = null;
  if (host === "wa.me") {
    const path = decodeURIComponent(url.pathname.replace(/^\//, "").split("/")[0] ?? "");
    digits = normalizePhoneDigits(path);
  } else {
    digits = normalizePhoneDigits(url.searchParams.get("phone") ?? "");
  }
  if (!digits) return null;

  const prefill = url.searchParams.get("text") ?? url.searchParams.get("body");
  const href = `https://wa.me/${digits}`;
  if (!prefill) return href;
  const clipped = prefill.length > MAX_PREFILL_CHARS ? prefill.slice(0, MAX_PREFILL_CHARS) : prefill;
  return `${href}?text=${encodeURIComponent(clipped)}`;
}

export function mentionsWhatsApp(text: string): boolean {
  return /واتساب|واتس(?:اب)?|whats?\s*app/i.test(text);
}

type FoundMatch = {
  start: number;
  end: number;
  href: string;
  label: string;
};

function collectFrom(
  text: string,
  source: RegExp,
  parse: (matched: string, index: number, groups: string[]) => FoundMatch | null,
): FoundMatch[] {
  const found: FoundMatch[] = [];
  const pattern = new RegExp(source.source, source.flags);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (!match[0]) {
      pattern.lastIndex += 1;
      continue;
    }
    const parsed = parse(match[0], match.index, match.slice(1));
    if (!parsed) continue;
    found.push(parsed);
  }
  return found;
}

function toMatch(
  start: number,
  consumed: string,
  href: string | null,
  label: string,
): FoundMatch | null {
  if (!href || start < 0) return null;
  return { start, end: start + consumed.length, href, label };
}

/**
 * Splits assistant copy into plain text and sanitized WhatsApp actions.
 * Dates, prices, and unrelated URLs stay as text.
 */
export function splitChatTextWithWhatsApp(
  text: string,
  options?: { allowLocalMobile?: boolean },
): ChatWhatsAppSegment[] {
  if (!text) return [{ type: "text", value: text }];

  const allowLocal = options?.allowLocalMobile === true;
  const found: FoundMatch[] = [
    ...collectFrom(text, MARKDOWN_WA_RE, (raw, index, groups) => {
      const href = sanitizeWhatsAppHref(groups[1] ?? "");
      const digits = href ? digitsFromHref(href) : null;
      if (!href || !digits) return null;
      return toMatch(index, raw, href, displayLabel(raw, digits, groups[0]));
    }),
    ...collectFrom(text, WA_URL_RE, (raw, index) => {
      const { core } = stripTrailingPunctuation(raw);
      const href = sanitizeWhatsAppHref(core);
      const digits = href ? digitsFromHref(href) : null;
      if (!href || !digits) return null;
      return toMatch(index, core, href, displayLabel(core, digits));
    }),
    ...collectFrom(text, BARE_WA_ME_RE, (raw, index) => {
      const { core } = stripTrailingPunctuation(raw);
      const href = sanitizeWhatsAppHref(core);
      const digits = href ? digitsFromHref(href) : null;
      if (!href || !digits) return null;
      return toMatch(index, core, href, displayLabel(core, digits));
    }),
    ...collectFrom(text, INTL_PHONE_RE, (raw, index) => {
      const compact = toAsciiDigits(raw).replace(/[\s-]/g, "");
      if (ISO_DATE_RE.test(compact)) return null;
      const href = sanitizeWhatsAppHref(raw);
      const digits = href ? digitsFromHref(href) : null;
      if (!href || !digits) return null;
      return toMatch(index, raw, href, displayLabel(raw, digits));
    }),
  ];

  if (allowLocal) {
    found.push(
      ...collectFrom(text, LOCAL_MOBILE_RE, (raw, index) => {
        const href = sanitizeWhatsAppHref(raw);
        const digits = href ? digitsFromHref(href) : null;
        if (!href || !digits) return null;
        return toMatch(index, raw, href, displayLabel(raw, digits));
      }),
    );
  }

  found.sort((a, b) => a.start - b.start || b.end - a.end);

  const picked: FoundMatch[] = [];
  let cursor = 0;
  for (const item of found) {
    if (item.start < cursor) continue;
    picked.push(item);
    cursor = item.end;
  }

  if (picked.length === 0) return [{ type: "text", value: text }];

  const segments: ChatWhatsAppSegment[] = [];
  let last = 0;
  for (const item of picked) {
    if (item.start > last) {
      segments.push({ type: "text", value: text.slice(last, item.start) });
    }
    segments.push({ type: "whatsapp", href: item.href, label: item.label });
    last = item.end;
  }
  if (last < text.length) {
    segments.push({ type: "text", value: text.slice(last) });
  }
  return segments;
}
