export const FAB_POSITION_STORAGE_KEY = "wesal_ai_fab_position";

/** Keeps the button clear of every viewport edge, whatever the saved value says. */
export const FAB_VIEWPORT_MARGIN_PX = 8;
/** Must track the button's rendered size (`h-14 w-14`); only the boot script needs it. */
const FAB_SIZE_PX = 56;

export const FAB_PLACED_ATTRIBUTE = "data-wesal-fab-placed";
export const FAB_LEFT_CSS_VAR = "--wesal-fab-left";
export const FAB_TOP_CSS_VAR = "--wesal-fab-top";

/**
 * The saved spot is kept as a fraction of the free space on each axis rather than
 * raw pixels, so a position chosen on a desktop screen stays meaningful on a phone
 * and can never resolve to coordinates outside the viewport.
 */
export type FabPositionRatio = { x: number; y: number };

function isFraction(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
  );
}

export function isFabPositionRatio(value: unknown): value is FabPositionRatio {
  if (typeof value !== "object" || value === null) return false;
  const { x, y } = value as Record<string, unknown>;
  return isFraction(x) && isFraction(y);
}

export function clearStoredFabPosition(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(FAB_POSITION_STORAGE_KEY);
  } catch {
    // Storage unavailable — the button just falls back to its default corner.
  }
}

/** Returns `null` for missing, unparsable or out-of-range values. */
export function readStoredFabPosition(): FabPositionRatio | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FAB_POSITION_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (isFabPositionRatio(parsed)) return parsed;

    // Corrupt or outdated shape: drop it so it cannot break the next load either.
    clearStoredFabPosition();
    return null;
  } catch {
    return null;
  }
}

export function writeStoredFabPosition(ratio: FabPositionRatio): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FAB_POSITION_STORAGE_KEY, JSON.stringify(ratio));
  } catch {
    // Quota or private-mode failure: the drag still applies for this session.
  }
}

/**
 * Inline boot script — runs before first paint so a saved position is never seen
 * jumping in from the default corner. The button does not exist yet at this point,
 * so the resolved coordinates are published as custom properties on the root
 * element and picked up by the button's stylesheet the moment it renders.
 *
 * It repeats the validation and clamping deliberately: it cannot import, and a bad
 * stored value must leave the default corner untouched instead of throwing.
 */
export const FAB_POSITION_BOOT_SCRIPT = `(function(){try{var r=localStorage.getItem(${JSON.stringify(
  FAB_POSITION_STORAGE_KEY,
)});if(!r)return;var v=JSON.parse(r);if(!v||typeof v!=="object")return;var x=v.x,y=v.y;if(typeof x!=="number"||typeof y!=="number"||!isFinite(x)||!isFinite(y)||x<0||x>1||y<0||y>1)return;var m=${FAB_VIEWPORT_MARGIN_PX},s=${FAB_SIZE_PX};var fx=Math.max(0,window.innerWidth-s-m*2),fy=Math.max(0,window.innerHeight-s-m*2);var d=document.documentElement;d.style.setProperty(${JSON.stringify(
  FAB_LEFT_CSS_VAR,
)},(m+x*fx)+"px");d.style.setProperty(${JSON.stringify(
  FAB_TOP_CSS_VAR,
)},(m+y*fy)+"px");d.setAttribute(${JSON.stringify(
  FAB_PLACED_ATTRIBUTE,
)},"true");}catch(e){}})();`;
