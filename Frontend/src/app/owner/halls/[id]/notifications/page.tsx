import HallOwnerHallNotificationsView from "@/components/owner-management/halls/HallOwnerHallNotificationsView";

type OwnerHallNotificationsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ request_id?: string }>;
};

/**
 * Notifications for the selected Hall — route keeps hallId as source of truth.
 */
export default async function OwnerHallNotificationsPage({
  params,
  searchParams,
}: OwnerHallNotificationsPageProps) {
  const { id } = await params;
  const query = await searchParams;
  return (
    <HallOwnerHallNotificationsView key={id} hallId={id} requestId={query.request_id} />
  );
}
