/** Backend PublishingContentLimits + DocumentUploadValidator.EnsureValidImage */
export const PROFESSIONAL_POST_CONTENT_MAX = 2000;
export const PROFESSIONAL_POST_IMAGES_MAX = 10;
export const PROFESSIONAL_POST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PROFESSIONAL_POST_IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
export const PROFESSIONAL_POST_MAX_MONEY = 9_999_999_999.99;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export type ProfessionalPostContentIssue = "tooLong";
export type ProfessionalPostPriceIssue = "invalid" | "negative" | "tooLarge" | "decimals";
export type ProfessionalPostImagesIssue =
  | "required"
  | "tooMany"
  | "emptyFile"
  | "tooLarge"
  | "type";

export function validateProfessionalPostContent(
  content: string,
): ProfessionalPostContentIssue | null {
  if (content.trim().length > PROFESSIONAL_POST_CONTENT_MAX) return "tooLong";
  return null;
}

export function parseProfessionalPostPrice(
  raw: string,
): { value: number | null; issue: ProfessionalPostPriceIssue | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null, issue: null };
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { value: null, issue: "invalid" };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { value: null, issue: "invalid" };
  if (value < 0) return { value: null, issue: "negative" };
  if (value > PROFESSIONAL_POST_MAX_MONEY) return { value: null, issue: "tooLarge" };
  if (Math.round(value * 100) / 100 !== value) return { value: null, issue: "decimals" };
  return { value, issue: null };
}

export function validateProfessionalPostImageFile(
  file: File,
): ProfessionalPostImagesIssue | null {
  if (file.size <= 0) return "emptyFile";
  if (file.size > PROFESSIONAL_POST_IMAGE_MAX_BYTES) return "tooLarge";
  const mime = (file.type || "").toLowerCase();
  const ext = `.${(file.name.split(".").pop() || "").toLowerCase()}`;
  if (!ALLOWED_MIME.has(mime) || !ALLOWED_EXT.has(ext)) return "type";
  return null;
}

export function validateProfessionalPostImages(
  files: File[],
  options?: { required?: boolean; existingCount?: number },
): ProfessionalPostImagesIssue | null {
  const required = options?.required ?? false;
  const existingCount = options?.existingCount ?? 0;
  const total = existingCount + files.length;
  if (required && total === 0) return "required";
  if (total > PROFESSIONAL_POST_IMAGES_MAX) return "tooMany";
  for (const file of files) {
    const issue = validateProfessionalPostImageFile(file);
    if (issue) return issue;
  }
  return null;
}

/** Backend create rule: at least one image or non-empty content. */
export function hasProfessionalPostBody(
  content: string,
  imageCount: number,
): boolean {
  return imageCount > 0 || Boolean(content.trim());
}
