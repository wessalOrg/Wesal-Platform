import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SEEKER_DASHBOARD_PATH } from "@/constants/seekerDashboardNav";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("meta.seekerFavoritesTitle", "ar"),
  description: translate("meta.seekerFavoritesDescription", "ar"),
};

/** Favorites removed from seeker dashboard. */
export default function SeekerFavoritesRoutePage() {
  redirect(SEEKER_DASHBOARD_PATH);
}
