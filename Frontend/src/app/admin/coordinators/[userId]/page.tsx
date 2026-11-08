import AdminCoordinatorRequestDetailView from "@/components/admin/coordinators/AdminCoordinatorRequestDetailView";

type AdminCoordinatorDetailPageProps = {
  params: Promise<{ userId: string }>;
};

export default async function AdminCoordinatorDetailPage({
  params,
}: AdminCoordinatorDetailPageProps) {
  const { userId } = await params;
  return <AdminCoordinatorRequestDetailView userId={decodeURIComponent(userId)} />;
}
