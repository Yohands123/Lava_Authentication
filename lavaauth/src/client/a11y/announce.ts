// Single polite live region for every state change (the canvas is aria-hidden).
let region: HTMLElement | null = null;

export function announce(message: string): void {
  region ??= document.querySelector<HTMLElement>("[data-announcer]");
  if (!region) return;
  region.textContent = "";
  // Next frame so repeated messages are still announced.
  requestAnimationFrame(() => {
    if (region) region.textContent = message;
  });
}
