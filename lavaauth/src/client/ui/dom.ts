export function $(selector: string, root: ParentNode = document): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
}

export type ScreenName = "landing" | "choose" | "stir" | "waiting" | "success";

/** Cross-fade to a screen. CSS handles the slow ease; nothing snaps. */
export function showScreen(name: ScreenName): void {
  for (const el of document.querySelectorAll<HTMLElement>("[data-screen]")) {
    const active = el.dataset.screen === name;
    el.classList.toggle("is-active", active);
    el.inert = !active;
    el.setAttribute("aria-hidden", String(!active));
  }
  const target = document.querySelector<HTMLElement>(`[data-screen="${name}"] [data-autofocus]`);
  window.setTimeout(() => target?.focus({ preventScroll: true }), 650);
}
