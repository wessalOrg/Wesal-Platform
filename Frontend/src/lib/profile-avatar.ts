const AVATAR_PREFIX = "wesal_profile_avatar:";
const MAX_BYTES = 2 * 1024 * 1024;
const STORE_MAX_EDGE = 256;
const STORE_JPEG_QUALITY = 0.82;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function storageKey(userId: string) {
  return `${AVATAR_PREFIX}${userId}`;
}

export function readProfileAvatar(userId: string): string | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const value = localStorage.getItem(storageKey(userId));
    return value && value.startsWith("data:image/") ? value : null;
  } catch {
    return null;
  }
}

export function writeProfileAvatar(userId: string, dataUrl: string): void {
  if (typeof window === "undefined" || !userId) return;
  localStorage.setItem(storageKey(userId), dataUrl);
  window.dispatchEvent(
    new CustomEvent("wesal:profile-avatar", { detail: { userId, dataUrl } }),
  );
}

export function clearProfileAvatar(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  localStorage.removeItem(storageKey(userId));
  window.dispatchEvent(
    new CustomEvent("wesal:profile-avatar", { detail: { userId, dataUrl: null } }),
  );
}

export type ProfileAvatarReadIssue = "type" | "size" | "read";

function compressDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, STORE_MAX_EDGE / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(image, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL("image/jpeg", STORE_JPEG_QUALITY));
      } catch {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

export function readImageFileAsDataUrl(
  file: File,
): Promise<{ ok: true; dataUrl: string } | { ok: false; issue: ProfileAvatarReadIssue }> {
  if (!ACCEPTED.has(file.type)) {
    return Promise.resolve({ ok: false, issue: "type" });
  }
  if (file.size > MAX_BYTES) {
    return Promise.resolve({ ok: false, issue: "size" });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve({ ok: false, issue: "read" });
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl.startsWith("data:image/")) {
        resolve({ ok: false, issue: "read" });
        return;
      }
      void compressDataUrl(dataUrl).then((compressed) => {
        resolve({ ok: true, dataUrl: compressed });
      });
    };
    reader.readAsDataURL(file);
  });
}
