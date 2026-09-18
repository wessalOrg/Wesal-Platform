import {
  apiFetchProfile,
  apiUpdateProfile,
  fetchProfile,
  profileUsesMock,
  updateProfile,
} from "@/services/profile";
import type { UpdateProfileInput, UserProfile } from "@/types/profile";

/**
 * Hall Owner management Profile — reuses the shared GET/PUT /profile contract.
 * Identity is always the authenticated session (server-side); no client-chosen user id.
 */
export async function fetchHallOwnerManagementProfile(
  displayName: string | null = null,
): Promise<UserProfile> {
  if (profileUsesMock()) return fetchProfile(displayName);
  return apiFetchProfile();
}

export async function updateHallOwnerManagementProfile(
  input: UpdateProfileInput,
  displayName: string | null = null,
): Promise<UserProfile> {
  if (profileUsesMock()) return updateProfile(input, displayName);
  return apiUpdateProfile(input);
}
