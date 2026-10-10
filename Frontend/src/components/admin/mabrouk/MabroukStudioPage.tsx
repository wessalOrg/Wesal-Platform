import MabroukAnalyticsPage from "@/components/admin/mabrouk/MabroukAnalyticsPage";
import MabroukHistoryPage from "@/components/admin/mabrouk/MabroukHistoryPage";
import MabroukKnowledgeLibraryPage from "@/components/admin/mabrouk/MabroukKnowledgeLibraryPage";
import MabroukOverviewPage from "@/components/admin/mabrouk/MabroukOverviewPage";
import MabroukSimulatorPage from "@/components/admin/mabrouk/MabroukSimulatorPage";
import MabroukUnansweredPage from "@/components/admin/mabrouk/MabroukUnansweredPage";
import MabroukStudioFrame from "@/components/admin/mabrouk/MabroukStudioFrame";

export type MabroukStudioSection = "overview" | "knowledge" | "unanswered" | "simulator" | "analytics" | "history";

export default function MabroukStudioPage({ section, simulatorQuestion = "" }: { section: MabroukStudioSection; simulatorQuestion?: string }) {
  const content = {
    overview: <MabroukOverviewPage />,
    knowledge: <MabroukKnowledgeLibraryPage />,
    unanswered: <MabroukUnansweredPage />,
    simulator: <MabroukSimulatorPage initialQuestion={simulatorQuestion} />,
    analytics: <MabroukAnalyticsPage />,
    history: <MabroukHistoryPage />,
  }[section];
  return <MabroukStudioFrame>{content}</MabroukStudioFrame>;
}
