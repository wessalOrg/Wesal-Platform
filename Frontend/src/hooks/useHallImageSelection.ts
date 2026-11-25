"use client";

import { useLayoutEffect, useMemo } from "react";
import { partitionHallImages } from "@/lib/hall-image-validation";

type Result = Awaited<ReturnType<typeof partitionHallImages>>;
function createSelectionOwner(isCurrent: () => boolean) {
  let active = false, pending = 0, coverVersion = 0;
  let tail = Promise.resolve();
  return {
    activate: () => { active = true; },
    dispose: () => { active = false; },
    cancelCover: () => { coverVersion += 1; },
    isPending: () => active && pending > 0,
    select(files: FileList | File[], cover: boolean, commit: (result: Result) => void) {
      if (!active || !isCurrent()) return Promise.resolve();
      const copied = Array.from(files), version = cover ? ++coverVersion : 0;
      pending += 1;
      const request = tail.then(async () => {
        if (!active || !isCurrent()) return;
        const result = await partitionHallImages(copied);
        if (active && isCurrent() && (!cover || version === coverVersion)) commit(result);
      }).finally(() => { pending -= 1; });
      tail = request.catch(() => {});
      return request;
    },
  };
}

/** Ordered selections and replaceable covers belong to one mounted account/hall context. */
export function useHallImageSelection(context: object, isCurrent: () => boolean) {
  const owner = useMemo(() => ({ context, ...createSelectionOwner(isCurrent) }), [context, isCurrent]);
  useLayoutEffect(() => { owner.activate(); return owner.dispose; }, [owner]);
  return owner;
}
