const query = window.matchMedia("(prefers-reduced-motion: reduce)");

export function prefersReducedMotion(): boolean {
  return query.matches;
}

export function onReducedMotionChange(fn: (reduced: boolean) => void): void {
  query.addEventListener("change", () => fn(query.matches));
}
