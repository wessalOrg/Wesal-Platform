"use client";

import dynamic from "next/dynamic";

function SeekerPageSkeleton() {
  return (
    <div
      className="h-72 animate-pulse rounded-[1.4rem] bg-white/80"
      aria-busy="true"
    />
  );
}

export default dynamic(() => import("./SeekerBookingsPage"), {
  ssr: false,
  loading: () => <SeekerPageSkeleton />,
});
