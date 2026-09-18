"use client";

import { useMemo } from "react";
import {
  parseSubscriptionExpiryWarningMessage,
  type ClassifiedExpiryWarningContent,
} from "@/lib/subscription-expiry-warning-message";

export function useSubscriptionExpiryWarningMessage(
  content: string,
  fallbackHallName = "",
): ClassifiedExpiryWarningContent {
  return useMemo(
    () => parseSubscriptionExpiryWarningMessage(content, fallbackHallName),
    [content, fallbackHallName],
  );
}
