import AdminPhotographerRequestDetailView from "@/components/admin/photographers/AdminPhotographerRequestDetailView";

type AdminPhotographerDetailPageProps = {
  params: Promise<{ userId: string }>;
};

export default async function AdminPhotographerDetailPage({
  params,
}: AdminPhotographerDetailPageProps) {
  const { userId } = await params;
  return <AdminPhotographerRequestDetailView userId={decodeURIComponent(userId)} />;
}
