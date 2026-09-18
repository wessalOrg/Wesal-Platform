import HallOwnerHallManagementView from "@/components/owner-management/halls/HallOwnerHallManagementView";

type OwnerHallPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Hall selection source of truth: route param `id` (US-OWNER-08).
 * `key` remounts the view so form/state never leaks across Halls.
 */
export default async function OwnerHallPage({ params }: OwnerHallPageProps) {
  const { id } = await params;
  return <HallOwnerHallManagementView key={id} hallId={id} />;
}
