import type { Metadata } from "next";
import ProfessionalPostsManagePage from "@/components/professionals/ProfessionalPostsManagePage";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("professionals.posts.title", "ar"),
  description: translate("dashboard.posts.subtitle", "ar"),
};

export default function ProfessionalPostsRoutePage() {
  return <ProfessionalPostsManagePage />;
}
