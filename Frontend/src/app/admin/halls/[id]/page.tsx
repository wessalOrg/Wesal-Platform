import AdminHallSubmissionDetailView from "@/components/admin/halls/AdminHallSubmissionDetailView";

type AdminHallPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminHallSubmissionPage({ params }: AdminHallPageProps) {
  const { id } = await params;
  return <AdminHallSubmissionDetailView key={id} hallId={id} />;
}
