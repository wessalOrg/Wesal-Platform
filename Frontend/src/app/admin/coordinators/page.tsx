import { Suspense } from "react";
import AdminCoordinatorRequestsView from "@/components/admin/coordinators/AdminCoordinatorRequestsView";

export default function AdminCoordinatorsPage() {
  return (
    <Suspense
      fallback={
        <div
          className="seeker-pending-panel h-40 animate-pulse"
          aria-busy="true"
          data-testid="admin-coordinator-requests-loading"
        />
      }
    >
      <AdminCoordinatorRequestsView />
    </Suspense>
  );
}
