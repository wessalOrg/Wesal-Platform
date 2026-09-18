import HallOwnerHallNotificationsView from "@/components/owner-management/halls/HallOwnerHallNotificationsView";

type OwnerHallNotificationsPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Notifications for the selected Hall — route keeps hallId as source of truth.
 */
export default async function OwnerHallNotificationsPage({
  params,
}: OwnerHallNotificationsPageProps) {
  const { id } = await params;
  return <HallOwnerHallNotificationsView key={id} hallId={id} />;
}
