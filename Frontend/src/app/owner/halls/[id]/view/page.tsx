import OwnerHallReadOnlyView from "@/components/owner-management/halls/OwnerHallReadOnlyView";

type OwnerHallViewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OwnerHallViewPage({ params }: OwnerHallViewPageProps) {
  const { id } = await params;
  return <OwnerHallReadOnlyView key={id} hallId={id} />;
}
