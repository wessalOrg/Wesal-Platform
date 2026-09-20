/**
 * Converts common YouTube URL shapes to the embeddable form used in iframes.
 * Returns null when the value does not contain a recognizable video id.
 */
export function toYouTubeEmbedUrl(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  let id: string | null = null;

  const youtuBe = raw.match(/^https?:\/\/(www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(\?.*)?$/i);
  if (youtuBe) id = youtuBe[2];

  const watch = raw.match(/^https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(&.*)?$/i);
  if (!id && watch) id = watch[2];

  const embed = raw.match(/^https?:\/\/(www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(\?.*)?$/i);
  if (!id && embed) id = embed[2];

  const shorts = raw.match(/^https?:\/\/(www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})(\?.*)?$/i);
  if (!id && shorts) id = shorts[2];

  return id ? `https://www.youtube.com/embed/${id}` : null;
}