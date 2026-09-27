"use client";

import { useMemo } from "react";
import { useProfileAvatarUrl } from "@/hooks/useProfileAvatarUrl";
import { useUserBookings } from "@/hooks/useUserBookings";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import { useUserProfile, type UseUserProfile } from "@/hooks/useUserProfile";
import { memberSinceYear, profileDisplayName } from "@/lib/profile-mapper";

export type SeekerProfileDisplay = {
  id: string | null;
  fullName: string;
  email: string;
  phoneNumber: string;
  avatarUrl: string | null;
  createdAt: string | null;
  memberYear: string | null;
  initials: string;
};

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "و";
}

/**
 * Seeker profile presentation model — GET /profile plus session fallbacks.
 */
export function useSeekerProfile(): UseUserProfile & {
  display: SeekerProfileDisplay;
  bookings: ReturnType<typeof useUserBookings>;
} {
  const identity = useUserIdentity();
  const profileState = useUserProfile();
  const bookings = useUserBookings();
  const avatarUrl = useProfileAvatarUrl([profileState.profile?.id, identity.profile?.id]);

  const display = useMemo<SeekerProfileDisplay>(() => {
    const fullName = profileDisplayName(profileState.profile, identity.displayName);
    const email = profileState.profile?.email?.trim() || identity.email?.trim() || "";
    const phoneNumber =
      profileState.profile?.phoneNumber?.trim() || identity.phoneNumber?.trim() || "";
    const createdAt = profileState.profile?.createdAt?.trim() || null;
    return {
      id: profileState.profile?.id ?? identity.profile?.id ?? null,
      fullName,
      email,
      phoneNumber,
      avatarUrl,
      createdAt,
      memberYear: memberSinceYear(createdAt),
      initials: initialsFrom(fullName),
    };
  }, [avatarUrl, identity.displayName, identity.email, identity.phoneNumber, identity.profile?.id, profileState.profile]);

  return {
    ...profileState,
    display,
    bookings,
  };
}
