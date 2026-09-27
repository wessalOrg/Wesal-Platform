import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { getStoredAuth } from "@/lib/auth-storage";
import { getAccessToken } from "@/lib/auth-token";
import { ProfileError, toProfileError } from "@/lib/profile-errors";
import { mapProfileDto } from "@/lib/profile-mapper";
import { mockFetchProfile, mockUpdateProfile } from "@/services/profile-mock";
import type { UpdateProfileInput, UserProfile } from "@/types/profile";

function attachKnownUserId(profile: UserProfile): UserProfile {
  if (profile.id && profile.id !== "self") return profile;
  const storedId = getStoredAuth()?.user?.id?.trim();
  if (storedId && storedId !== "self") {
    return { ...profile, id: storedId };
  }
  return profile;
}

function mapProfile(data: unknown): UserProfile {
  return attachKnownUserId(mapProfileDto(data));
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
    const { data } = await api.get<unknown>("/profile", { timeout: 8000 });
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
    const { data } = await api.put<unknown>(
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
