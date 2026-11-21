"use client";

import { useLayoutEffect, useState } from "react";
import { createRequestScope } from "@/lib/request-scope";

/** Invalidate callbacks synchronously when a context workspace leaves the tree. */
export function useRequestScope() {
  const [scope] = useState(createRequestScope);
  useLayoutEffect(() => {
    scope.activate();
    return () => scope.dispose();
  }, [scope]);
  return scope;
}
