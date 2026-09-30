import { Suspense } from "react";
import AdminHallSubmissionDetailView from "@/components/admin/halls/AdminHallSubmissionDetailView";

type AdminHallPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminHallSubmissionPage({ params }: AdminHallPageProps) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <section className="admin-ops-section" aria-busy="true">
          <div className="h-40 animate-pulse rounded-xl bg-[var(--wesal-pink)]/60" />
        </section>
      }
    >
      <AdminHallSubmissionDetailView key={id} hallId={id} />
    </Suspense>
  );
}
