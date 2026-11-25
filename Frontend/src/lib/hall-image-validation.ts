/** Mirrors HallPhotoUploadValidator. Backend validation remains the security boundary. */
export const HALL_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const HALL_CREATE_MAX_PHOTOS = 10;
export const HALL_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
export type HallImageIssue = { name: string; key: string };
export type HallImageIssues = { mainPhoto?: HallImageIssue[]; photos?: HallImageIssue[] };
const mimeByExtension: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
};
const inspected = new WeakMap<File, Promise<HallImageIssue | null>>();

export function hallImageMetadataError(file: File): HallImageIssue | null {
  const issue = (code: string) => ({ name: file.name, key: "owner.hallImages." + code });
  if (file.size === 0) return issue("empty");
  if (file.size > HALL_IMAGE_MAX_BYTES) return issue("tooLarge");
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const mime = file.type.toLowerCase();
  if (!Object.hasOwn(mimeByExtension, extension) || !Object.values(mimeByExtension).includes(mime)) return issue("format");
  if (mimeByExtension[extension] !== mime) return issue("mismatch");
  return null;
}

export function validateHallImage(file: File): Promise<HallImageIssue | null> {
  const metadata = hallImageMetadataError(file);
  if (metadata) return Promise.resolve(metadata);
  const previous = inspected.get(file);
  if (previous) return previous;
  const result = (async () => {
    try {
      const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const starts = (signature: number[], offset = 0) => bytes.length >= offset + signature.length
        && signature.every((byte, index) => bytes[offset + index] === byte);
      const valid = file.type.toLowerCase() === "image/jpeg" ? starts([255, 216, 255])
        : file.type.toLowerCase() === "image/png" ? starts([137, 80, 78, 71, 13, 10, 26, 10])
        : starts([82, 73, 70, 70]) && starts([87, 69, 66, 80], 8);
      return valid ? null : { name: file.name, key: "owner.hallImages.content" };
    } catch { return { name: file.name, key: "owner.hallImages.unreadable" }; }
  })();
  inspected.set(file, result);
  return result;
}

export async function partitionHallImages(files: readonly File[]) {
  const results = await Promise.all(files.map(validateHallImage));
  return { accepted: files.filter((_, index) => !results[index]),
    rejected: results.filter((issue): issue is HallImageIssue => issue !== null) };
}
export function formatHallImageIssues(issues: HallImageIssue[], t: (key: string) => string): string {
  return issues.map(issue => `“${issue.name}”: ${t(issue.key)}`).join("\n");
}
export class HallImageValidationError extends Error {
  constructor(public readonly issues: HallImageIssues) { super("owner.management.addHall.errors.validation"); }
}
/** Last boundary before multipart transport, including callers that bypass the picker. */
export async function assertHallImages(mainPhoto: File | null, photos: readonly File[], maxPhotos?: number) {
  const issues: HallImageIssues = {};
  if (mainPhoto) {
    const issue = await validateHallImage(mainPhoto);
    if (issue) issues.mainPhoto = [issue];
  }
  const result = await partitionHallImages(photos);
  if (result.rejected.length) issues.photos = result.rejected;
  if (maxPhotos !== undefined && photos.length > maxPhotos) {
    issues.photos = [...(issues.photos ?? []), ...photos.slice(maxPhotos).map(file => ({ name: file.name, key: "owner.hallImages.count" }))];
  }
  if (issues.mainPhoto || issues.photos) throw new HallImageValidationError(issues);
}
