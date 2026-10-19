import type { Metadata } from "next";
import SeekerFavoritesPage from "@/components/seeker-dashboard/SeekerFavoritesPage.lazy";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("meta.seekerFavoritesTitle", "ar"),
  description: translate("meta.seekerFavoritesDescription", "ar"),
};

export default function SeekerFavoritesRoutePage() {
  return <SeekerFavoritesPage />;
}
