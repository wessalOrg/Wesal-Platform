"use client";

import { useEffect } from "react";
import { useUserProfileStore } from "@/components/profile/UserProfileProvider";

/** Refetch once when entering the Regular User portal so back-navigation is fresh. */
export default function ProfileRouteSync() {
  const { refetch } = useUserProfileStore();

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return null;
}
