import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";
import { fieldErrorsFromUnknown, ProfileError, toProfileError } from "@/lib/profile-errors";
import { mockFetchProfile, mockUpdateProfile } from "@/services/profile-mock";
import type { UpdateProfileInput, UserProfile } from "@/types/profile";

type ProfileDto = {
  id?: string;
  userId?: string;
  fullName?: string | null;
  name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  phone?: string | null;
  concurrencyStamp?: string | null;
  version?: number;
};

function mapProfile(data: ProfileDto): UserProfile {
  const stamp =
    (data.concurrencyStamp ?? "").trim() ||
    (typeof data.version === "number" ? String(data.version) : "");
  return {
    id: String(data.id ?? data.userId ?? "self"),
    fullName: (data.fullName ?? data.name ?? "").trim(),
    email: (data.email ?? "").trim(),
    phoneNumber: (data.phoneNumber ?? data.phone ?? "").trim(),
    concurrencyStamp: stamp,
  };
}

function raiseFromApi(err: unknown): never {
  throw toProfileError(err, "errors.profile.save");
}

/** Live JWT talks to GET/PUT /profile. Demo stub login stays on the mock store. */
export function profileUsesMock(): boolean {
  const token = getAccessToken();
  return !token || token.startsWith("stub-");
}

export async function apiFetchProfile(): Promise<UserProfile> {
  try {
    const { data } = await api.get<ProfileDto>("/profile", { timeout: 8000 });
    return mapProfile(data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      throw new ProfileError("errors.profile.load", 401);
    }
    throw toProfileError(err, "errors.profile.load");
  }
}

export async function apiUpdateProfile(input: UpdateProfileInput): Promise<UserProfile> {
  try {
    const { data } = await api.put<ProfileDto>(
      "/profile",
      {
        fullName: input.fullName,
        email: input.email,
        phoneNumber: input.phoneNumber,
        concurrencyStamp: input.concurrencyStamp,
      },
      { timeout: 8000 },
    );
    return mapProfile(data);
  } catch (err) {
    raiseFromApi(err);
  }
}

export async function fetchProfile(displayName: string | null): Promise<UserProfile> {
  if (profileUsesMock()) return mockFetchProfile(displayName);
  return apiFetchProfile();
}

export async function updateProfile(
  input: UpdateProfileInput,
  displayName: string | null,
): Promise<UserProfile> {
  if (profileUsesMock()) return mockUpdateProfile(input, displayName);
  return apiUpdateProfile(input);
}
