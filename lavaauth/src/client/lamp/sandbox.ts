// npm run lamp: the lamp alone, with live sliders. Drag to stir.
// Tune here, then copy the values into constants.ts.

import "@fontsource/inter-tight/400.css";
import "@fontsource/inter-tight/500.css";
import "@fontsource/jetbrains-mono/400.css";
import "../ui/styles.css";
import "./sandbox.css";
import { Lamp } from "./lamp";
import { LAMP, STIR } from "./constants";

const lamp = new Lamp(document.querySelector<HTMLCanvasElement>("#lamp")!);

type Group = Record<string, number>;
const sliders: Array<{ group: Group; groupName: string; key: string; min: number; max: number; step: number }> = [
  { group: LAMP, groupName: "LAMP", key: "BUOYANCY", min: 0, max: 0.3, step: 0.005 },
  { group: LAMP, groupName: "LAMP", key: "DRAG", min: 0.1, max: 3, step: 0.05 },
  { group: LAMP, groupName: "LAMP", key: "HEAT_RATE", min: 0, max: 0.4, step: 0.005 },
  { group: LAMP, groupName: "LAMP", key: "COOL_RATE", min: 0, max: 0.4, step: 0.005 },
  { group: LAMP, groupName: "LAMP", key: "WANDER", min: 0, max: 0.03, step: 0.001 },
  { group: LAMP, groupName: "LAMP", key: "MAX_DRIFT_SPEED", min: 0.01, max: 0.3, step: 0.005 },
  { group: LAMP, groupName: "LAMP", key: "GRAIN", min: 0, max: 0.1, step: 0.005 },
  { group: STIR, groupName: "STIR", key: "REPEL", min: 0, max: 4, step: 0.05 },
  { group: STIR, groupName: "STIR", key: "DRAG_ALONG", min: 0, max: 2, step: 0.05 },
  { group: STIR, groupName: "STIR", key: "SWIRL", min: 0, max: 2, step: 0.05 },
  { group: STIR, groupName: "STIR", key: "SPLIT_SPEED", min: 0.3, max: 5, step: 0.1 },
];

const host = document.querySelector<HTMLElement>("[data-sliders]")!;
for (const s of sliders) {
  const id = `${s.groupName}-${s.key}`;
  const row = document.createElement("div");
  row.className = "tuner-row";
  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = s.key.toLowerCase().replace(/_/g, " ");
  const input = document.createElement("input");
  input.type = "range";
  input.id = id;
  input.min = String(s.min);
  input.max = String(s.max);
  input.step = String(s.step);
  input.value = String(s.group[s.key]);
  const out = document.createElement("output");
  out.className = "mono";
  out.textContent = String(s.group[s.key]);
  input.addEventListener("input", () => {
    s.group[s.key] = Number(input.value);
    out.textContent = input.value;
  });
  row.append(label, out, input);
  host.append(row);
}

// Drag anywhere to stir.
let pointer: { x: number; y: number; vx: number; vy: number; t: number } | null = null;
window.addEventListener("pointermove", (e) => {
  const w = lamp.renderer.toWorld(e.clientX, e.clientY);
  if (pointer && e.buttons) {
    const dt = Math.max((e.timeStamp - pointer.t) / 1000, 0.004);
    pointer = { x: w.x, y: w.y, vx: (w.x - pointer.x) / dt, vy: (w.y - pointer.y) / dt, t: e.timeStamp };
  } else {
    pointer = { x: w.x, y: w.y, vx: 0, vy: 0, t: e.timeStamp };
  }
});
let down = false;
window.addEventListener("pointerdown", (e) => (down = !(e.target as HTMLElement).closest(".tuner")));
window.addEventListener("pointerup", () => (down = false));

lamp.onStep = (dt) => {
  if (pointer && down) {
    lamp.physics.stir(pointer.x, pointer.y, pointer.vx, pointer.vy, dt);
    pointer.vx *= Math.exp(-8 * dt);
    pointer.vy *= Math.exp(-8 * dt);
  } else if (pointer) {
    lamp.physics.heatAt(pointer.x, pointer.y, dt);
  }
};

const fps = document.querySelector<HTMLElement>("[data-fps]")!;
let frames = 0;
let since = performance.now();
lamp.onFrame = () => {
  frames++;
  const now = performance.now();
  if (now - since > 1000) {
    fps.textContent = `${frames} fps, ${lamp.physics.blobs.length} blobs, scale ${lamp.renderer.resolutionScale.toFixed(1)}`;
    frames = 0;
    since = now;
  }
};

document.querySelector("[data-copy]")!.addEventListener("click", () => {
  const values = Object.fromEntries(sliders.map((s) => [`${s.groupName}.${s.key}`, s.group[s.key]]));
  void navigator.clipboard.writeText(JSON.stringify(values, null, 2));
});
document.querySelector("[data-burst]")!.addEventListener("click", () => lamp.physics.burst());
document.querySelector("[data-drop]")!.addEventListener("click", () => lamp.physics.drop(false));

lamp.start();
