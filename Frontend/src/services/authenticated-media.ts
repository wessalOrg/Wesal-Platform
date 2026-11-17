import api from "@/lib/api";

/**
 * Fetches an API-mediated media path with the axios Bearer client and returns
 * a blob object URL. Use for `/api/v1/.../images/...` routes that reject bare
 * `<img>` requests when the content is not anonymously visible.
 */
export async function fetchAuthenticatedMediaBlob(
  imagePath: string,
): Promise<string | null> {
  const trimmed = imagePath.trim();
  if (!trimmed) return null;

  let path = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      path = url.pathname + url.search;
    } catch {
      return null;
    }
  }

  if (path.startsWith("/api/v1/")) {
    path = path.slice("/api/v1".length);
  }

  const { data, headers } = await api.get<Blob>(path, {
    responseType: "blob",
    timeout: 20000,
  });
  if (!(data instanceof Blob) || data.size === 0) return null;

  const typeHeader =
    typeof headers["content-type"] === "string"
      ? headers["content-type"].split(";")[0]?.trim()
      : "";
  const blob =
    typeHeader && !data.type ? new Blob([data], { type: typeHeader }) : data;
  return URL.createObjectURL(blob);
}

/** True when the URL must be loaded via the authenticated API client. */
export function isAuthenticatedMediaPath(url: string | null | undefined): boolean {
  const value = (url ?? "").trim();
  if (!value) return false;
  if (/\/api\/v1\/(?:offers|posts)\//i.test(value)) return true;
  if (/^\/(?:offers|posts)\/[^/]+\/images\//i.test(value)) return true;
  return false;
}
