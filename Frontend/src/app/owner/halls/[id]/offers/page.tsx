import HallOwnerHallOffersView from "@/components/owner-management/halls/HallOwnerHallOffersView";

type OwnerHallOffersPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Special offers for the selected Hall — route keeps hallId as source of truth.
 */
export default async function OwnerHallOffersPage({
  params,
}: OwnerHallOffersPageProps) {
  const { id } = await params;
  return <HallOwnerHallOffersView key={id} hallId={id} />;
}
