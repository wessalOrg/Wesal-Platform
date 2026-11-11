import type { Metadata } from "next";
import ProfessionalStatisticsPage from "@/components/statistics/ProfessionalStatisticsPage";
import { translate } from "@/i18n";

export const metadata: Metadata = {
  title: translate("meta.statisticsTitle", "ar"),
  description: translate("meta.statisticsDescription", "ar"),
};

export default function ProfileStatisticsRoutePage() {
  return <ProfessionalStatisticsPage />;
}
