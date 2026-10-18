/**
 * Extracts the video id from common YouTube URL shapes.
 * Returns null when the value does not contain a recognizable video id.
 */
export function toYouTubeVideoId(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let id: string | null = null;

  const youtuBe = normalized.match(/^https?:\/\/(www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(\?.*)?$/i);
  if (youtuBe) id = youtuBe[2];

  const watch = normalized.match(/^https?:\/\/(www\.|m\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(&.*)?$/i);
  if (!id && watch) id = watch[2];

  const embed = normalized.match(/^https?:\/\/(www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(\?.*)?$/i);
  if (!id && embed) id = embed[2];

  const shorts = normalized.match(/^https?:\/\/(www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})(\?.*)?$/i);
  if (!id && shorts) id = shorts[2];

  const live = normalized.match(/^https?:\/\/(www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})(\?.*)?$/i);
  if (!id && live) id = live[2];

  if (!id) id = videoIdFromQuery(normalized);

  return id;
}

/**
 * ASP.NET camelCase turns `YouTubeVideoUrl` into `youTubeVideoUrl`.
 * Accept every casing the API has sent.
 */
export function readYouTubeVideoUrl(source: object | null | undefined): string | null {
  if (!source) return null;
  const record = source as Record<string, unknown>;
  const raw = record.youtubeVideoUrl ?? record.youTubeVideoUrl ?? record.YouTubeVideoUrl;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/** True when the value is a YouTube link that contains a video id. */
export function isYouTubeVideoUrl(value: string | null | undefined): boolean {
  return toYouTubeVideoId(value) !== null;
}

/**
 * Canonical watch link the hall API already accepts.
 * Extra share params such as a playlist (`&list=`) are dropped.
 */
export function toStoredYouTubeUrl(value: string): string {
  const id = toYouTubeVideoId(value);
  return id ? `https://www.youtube.com/watch?v=${id}` : value.trim();
}

function videoIdFromQuery(normalized: string): string | null {
  try {
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    const youtubeHost =
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtu.be";
    if (!youtubeHost) return null;
    const fromQuery = url.searchParams.get("v");
    return fromQuery && /^[a-zA-Z0-9_-]{11}$/.test(fromQuery) ? fromQuery : null;
  } catch {
    return null;
  }
}

/**
 * Converts common YouTube URL shapes to the embeddable form used in iframes.
 * Returns null when the value does not contain a recognizable video id.
 */
export function toYouTubeEmbedUrl(value: string | null | undefined): string | null {
  const id = toYouTubeVideoId(value);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}
