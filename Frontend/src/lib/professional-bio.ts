/** Backend ProfessionalProfileService.MaxBioLength */
export const PROFESSIONAL_BIO_MAX = 300;

export type ProfessionalBioIssue = "tooLong";

export function validateProfessionalBio(bio: string): ProfessionalBioIssue | null {
  if (bio.trim().length > PROFESSIONAL_BIO_MAX) return "tooLong";
  return null;
}

export function toUpdateProfessionalBioPayload(bio: string): { bio: string | null } {
  const trimmed = bio.trim();
  return { bio: trimmed.length === 0 ? null : trimmed };
}
