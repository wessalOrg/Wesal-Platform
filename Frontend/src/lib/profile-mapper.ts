import type { UserProfile } from "@/types/profile";

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Accepts camelCase, PascalCase, or a one-level `{ data | profile }` wrapper. */
export function unwrapProfileDto(data: unknown): Record<string, unknown> {
  const root = asRecord(data);
  if (!root) return {};
  const nested = asRecord(root.data ?? root.Data ?? root.profile ?? root.Profile);
  return nested ?? root;
}

export function mapProfileDto(data: unknown): UserProfile {
  const dto = unwrapProfileDto(data);
  const stamp =
    asText(dto.concurrencyStamp ?? dto.ConcurrencyStamp) ||
    (typeof dto.version === "number"
      ? String(dto.version)
      : typeof dto.Version === "number"
        ? String(dto.Version)
        : "");
  const createdAt =
    asText(dto.createdAt ?? dto.CreatedAt ?? dto.joinedAt ?? dto.JoinedAt) || null;

  return {
    id: asText(dto.id ?? dto.Id ?? dto.userId ?? dto.UserId) || "self",
    fullName: asText(dto.fullName ?? dto.FullName ?? dto.name ?? dto.Name),
    email: asText(dto.email ?? dto.Email),
    phoneNumber: asText(dto.phoneNumber ?? dto.PhoneNumber ?? dto.phone ?? dto.Phone),
    concurrencyStamp: stamp,
    isIdentityDocumentUploaded: Boolean(
      dto.isIdentityDocumentUploaded ?? dto.IsIdentityDocumentUploaded,
    ),
    createdAt,
  };
}

export function profileDisplayName(
  profile: Pick<UserProfile, "fullName"> | null | undefined,
  fallback?: string | null,
): string {
  return profile?.fullName?.trim() || fallback?.trim() || "";
}

export function memberSinceYear(createdAt?: string | null): string | null {
  if (!createdAt?.trim()) return null;
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    const year = createdAt.match(/^(\d{4})/)?.[1];
    return year ?? null;
  }
  return String(parsed.getFullYear());
}
