"use client";

import dynamic from "next/dynamic";
import { useAdminOwnerMessage } from "@/components/admin/halls/AdminOwnerMessageProvider";

const AdminOwnerMessagePanel = dynamic(() => import("./AdminOwnerMessagePanel"), {
  ssr: false,
});

export default function AdminOwnerMessagePanelHost() {
  const { target } = useAdminOwnerMessage();
  if (!target) return null;
  return <AdminOwnerMessagePanel />;
}
