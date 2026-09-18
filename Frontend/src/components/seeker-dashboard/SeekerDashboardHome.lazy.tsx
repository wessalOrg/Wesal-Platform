"use client";

import dynamic from "next/dynamic";

function SeekerPageSkeleton() {
  return (
    <div
      className="seeker-dash-route-loading space-y-4"
      aria-busy="true"
      data-testid="seeker-page-skeleton"
    >
      <div className="h-10 w-2/5 max-w-xs animate-pulse rounded-xl bg-white/80" />
      <div className="h-40 animate-pulse rounded-[1.35rem] bg-white/80" />
      <div className="h-28 animate-pulse rounded-[1.35rem] bg-white/70" />
    </div>
  );
}

export default dynamic(() => import("./SeekerDashboardHome"), {
  ssr: false,
  loading: () => <SeekerPageSkeleton />,
});
