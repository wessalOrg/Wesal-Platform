import type { Metadata } from "next";
import ProfilePageView from "@/components/profile/ProfilePageView";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("meta.profileTitle", "ar"),
  description: translate("meta.profileDescription", "ar"),
};

export default function ProfilePage() {
  return <ProfilePageView />;
}
