import { Suspense } from "react";
import SeekerMessagesPage from "@/components/seeker-dashboard/SeekerMessagesPage";

export default function OwnerMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="h-72 animate-pulse rounded-[1.4rem] bg-white/80" aria-busy="true" />
      }
    >
      <SeekerMessagesPage />
    </Suspense>
  );
}
