"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toApproveHallError } from "@/lib/admin-approve-hall-errors";
import { notifyPublicHallsChanged } from "@/lib/public-halls-events";
import { approveAdminHall } from "@/services/admin-halls";
import type { AdminHallApprovalResult } from "@/types/admin-halls";

type UseApproveHallSubmissionOptions = {
  onApproved?: (result: AdminHallApprovalResult) => void;
};

export function useApproveHallSubmission(options?: UseApproveHallSubmissionOptions) {
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const onApprovedRef = useRef(options?.onApproved);
  useEffect(() => {
    onApprovedRef.current = options?.onApproved;
  });

  const clearError = useCallback(() => {
    setErrorKey(null);
  }, []);

  const approve = useCallback(async (hallId: string) => {
    const id = hallId.trim();
    if (!id || inFlightRef.current) return null;

    inFlightRef.current = true;
    setPending(true);
    setErrorKey(null);

    try {
      const result = await approveAdminHall(id);
      notifyPublicHallsChanged();
      onApprovedRef.current?.(result);
      return result;
    } catch (err) {
      const mapped = toApproveHallError(err);
      setErrorKey(mapped.message);
      return null;
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  }, []);

  return {
    approve,
    pending,
    errorKey,
    clearError,
  };
}
