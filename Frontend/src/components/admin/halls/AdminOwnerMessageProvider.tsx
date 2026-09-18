"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { AdminOwnerMessageTarget } from "@/types/admin-halls";

type AdminOwnerMessageContextValue = {
  target: AdminOwnerMessageTarget | null;
  openForHall: (next: AdminOwnerMessageTarget) => void;
  close: () => void;
};

const AdminOwnerMessageContext = createContext<AdminOwnerMessageContextValue | null>(null);

export function AdminOwnerMessageProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<AdminOwnerMessageTarget | null>(null);

  const close = useCallback(() => {
    setTarget(null);
  }, []);

  const openForHall = useCallback((next: AdminOwnerMessageTarget) => {
    const hallId = next.hallId.trim();
    if (!hallId) return;
    setTarget({
      hallId,
      hallName: next.hallName.trim(),
      ownerName: next.ownerName?.trim() || null,
    });
  }, []);

  const value = useMemo(
    () => ({ target, openForHall, close }),
    [close, openForHall, target],
  );

  return (
    <AdminOwnerMessageContext.Provider value={value}>{children}</AdminOwnerMessageContext.Provider>
  );
}

export function useAdminOwnerMessage() {
  const ctx = useContext(AdminOwnerMessageContext);
  if (!ctx) {
    throw new Error("useAdminOwnerMessage must be used within AdminOwnerMessageProvider");
  }
  return ctx;
}
