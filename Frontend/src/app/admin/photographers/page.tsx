import { Suspense } from "react";
import AdminPhotographerRequestsView from "@/components/admin/photographers/AdminPhotographerRequestsView";

export default function AdminPhotographersPage() {
  return (
    <Suspense
      fallback={
        <div
          className="seeker-pending-panel h-40 animate-pulse"
          aria-busy="true"
          data-testid="admin-photographer-requests-loading"
        />
      }
    >
      <AdminPhotographerRequestsView />
    </Suspense>
  );
}
