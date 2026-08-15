const LOCK_CLASS = "wesal-scroll-locked";

let lockCount = 0;

export function lockBodyScroll(): void {
  if (typeof document === "undefined") return;

  lockCount += 1;
  if (lockCount === 1) {
    document.documentElement.classList.add(LOCK_CLASS);
    document.body.classList.add(LOCK_CLASS);
  }
}

export function unlockBodyScroll(): void {
  if (typeof document === "undefined") return;
  if (lockCount === 0) return;

  lockCount -= 1;
  if (lockCount > 0) return;

  document.documentElement.classList.remove(LOCK_CLASS);
  document.body.classList.remove(LOCK_CLASS);
}

/** Force-unlock — used when navigating away or on route unmount. */
export function resetBodyScrollLock(): void {
  if (typeof document === "undefined") return;

  lockCount = 0;
  document.documentElement.classList.remove(LOCK_CLASS);
  document.body.classList.remove(LOCK_CLASS);
}
