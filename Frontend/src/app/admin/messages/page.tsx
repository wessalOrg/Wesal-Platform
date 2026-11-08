import { Suspense } from "react";
import AdminMessagesPage from "@/components/admin/messages/AdminMessagesPage";

export default function AdminMessagesRoutePage() {
  return (
    <Suspense
      fallback={
        <div
          className="seeker-pending-panel h-40 animate-pulse"
          aria-busy="true"
          data-testid="admin-messages-loading"
        />
      }
    >
      <AdminMessagesPage />
    </Suspense>
  );
}
