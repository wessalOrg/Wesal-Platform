import { Suspense } from "react";
import AdminPendingHallsView from "@/components/admin/halls/AdminPendingHallsView";

export default function AdminHomePage() {
  return (
    <Suspense fallback={<div className="seeker-pending-panel h-40 animate-pulse" aria-busy="true" />}>
      <AdminPendingHallsView />
    </Suspense>
  );
}
