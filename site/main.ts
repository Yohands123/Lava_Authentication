// Showcase page: the original lamp engine as a live background. Mouse/pen
// drag stirs; touch only warms the wax so the page still scrolls.

import "@fontsource/unbounded/300.css";
import "@fontsource/unbounded/600.css";
import "@fontsource/inter-tight/400.css";
import "@fontsource/inter-tight/500.css";
import "@fontsource/jetbrains-mono/400.css";
import "./site.css";
import { Lamp } from "../src/client/lamp/lamp";
import { LAMP } from "../src/client/lamp/constants";
import { prefersReducedMotion, onReducedMotionChange } from "../src/client/a11y/motion";

let lamp: Lamp | null = null;
try {
  lamp = new Lamp(document.querySelector<HTMLCanvasElement>("#lamp")!);
} catch {
  document.body.classList.add("no-webgl");
}

if (lamp) {
  const live = lamp;
  const applyMotion = (reduced: boolean) => (live.physics.speed = reduced ? LAMP.REDUCED_MOTION_SPEED : 1);
  applyMotion(prefersReducedMotion());
  onReducedMotionChange(applyMotion);

  let pointer: { x: number; y: number; vx: number; vy: number; t: number } | null = null;
  let stirring = false;
  window.addEventListener("pointermove", (e) => {
    const w = live.renderer.toWorld(e.clientX, e.clientY);
    const dt = pointer ? Math.max((e.timeStamp - pointer.t) / 1000, 0.004) : 1;
    pointer = pointer ? { x: w.x, y: w.y, vx: (w.x - pointer.x) / dt, vy: (w.y - pointer.y) / dt, t: e.timeStamp } : { x: w.x, y: w.y, vx: 0, vy: 0, t: e.timeStamp };
  }, { passive: true });
  window.addEventListener("pointerdown", (e) => {
    const onControl = (e.target as HTMLElement).closest("a, button, img, table, pre");
    stirring = e.pointerType !== "touch" && !onControl;
    document.body.classList.toggle("is-stirring", stirring);
  });
  const stop = () => { stirring = false; document.body.classList.remove("is-stirring"); };
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);

  live.onStep = (dt) => {
    if (!pointer) return;
    if (stirring) {
      live.physics.stir(pointer.x, pointer.y, pointer.vx, pointer.vy, dt);
      pointer.vx *= Math.exp(-8 * dt);
      pointer.vy *= Math.exp(-8 * dt);
    } else live.physics.heatAt(pointer.x, pointer.y, dt);
  };
  live.start();
}

// Dim the lamp behind long-form sections so text stays legible.
const hero = document.querySelector<HTMLElement>(".hero")!;
new IntersectionObserver(([entry]) => {
  document.body.classList.toggle("past-hero", !entry!.isIntersecting);
}, { threshold: 0.15 }).observe(hero);
