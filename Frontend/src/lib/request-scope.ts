/** Guards asynchronous work without changing the API or cancelling committed writes. */
export function createRequestScope() {
  let active = false;
  let epoch = 0;
  const generations = new Map<string, number>();
  const capture = () => {
    const capturedEpoch = epoch;
    return () => active && epoch === capturedEpoch;
  };
  return {
    activate() { active = true; },
    dispose() { active = false; epoch += 1; generations.clear(); },
    isActive: () => active,
    capture,
    latest(key: string) {
      const current = capture();
      const generation = (generations.get(key) ?? 0) + 1;
      generations.set(key, generation);
      return () => current() && generations.get(key) === generation;
    },
  };
}
