export const PROFESSIONAL_PICTURE_MAX_BYTES = 5 * 1024 * 1024;
export const PROFESSIONAL_PICTURE_ACCEPT =
  "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ProfessionalPictureIssue =
  | "empty"
  | "tooLarge"
  | "type"
  | null;

export function validateProfessionalPicture(file: File | null | undefined): ProfessionalPictureIssue {
  if (!file || file.size <= 0) return "empty";
  if (file.size > PROFESSIONAL_PICTURE_MAX_BYTES) return "tooLarge";
  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_MIME.has(mime)) return "type";
  return null;
}
