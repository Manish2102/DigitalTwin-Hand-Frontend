// simulator.js - a virtual hand that needs no phone.
//
// It produces exactly the same messages a phone does (21 joints, ~30 per second),
// so the twin cannot tell the difference. Digital twins use this to test logic,
// train people and run demos before (or without) touching the real asset.

import { ingest, setSource, on, $ } from "./core.js";

// joint offsets from the wrist (normalized image units) for each pose
const CURLED = {
  0: [0, 0], 1: [-0.05, -0.05], 2: [-0.08, -0.10], 3: [-0.05, -0.15], 4: [0.0, -0.18],
  5: [0, -0.20], 6: [0, -0.28], 7: [0, -0.24], 8: [0, -0.19],
  9: [0.03, -0.20], 10: [0.03, -0.28], 11: [0.03, -0.24], 12: [0.03, -0.18],
  13: [0.06, -0.19], 14: [0.06, -0.26], 15: [0.06, -0.22], 16: [0.06, -0.17],
  17: [0.09, -0.17], 18: [0.09, -0.23], 19: [0.09, -0.20], 20: [0.09, -0.16],
};
const INDEX_UP  = { 6: [0, -0.30], 7: [0, -0.35], 8: [0, -0.40] };
const MIDDLE_UP = { 10: [0.03, -0.28], 11: [0.03, -0.33], 12: [0.03, -0.38] };
const RING_UP   = { 14: [0.06, -0.26], 15: [0.06, -0.31], 16: [0.06, -0.35] };
const PINKY_UP  = { 18: [0.09, -0.22], 19: [0.09, -0.26], 20: [0.09, -0.30] };
const THUMB_OUT = { 3: [-0.11, -0.12], 4: [-0.15, -0.15] };
const POSES = {
  fist:  CURLED,
  draw:  { ...CURLED, ...INDEX_UP },
  hover: { ...CURLED, ...INDEX_UP, ...MIDDLE_UP },
  palm:  { ...CURLED, ...INDEX_UP, ...MIDDLE_UP, ...RING_UP, ...PINKY_UP, ...THUMB_OUT },
};

// shapes the fingertip follows (u goes 0 -> 1)
function heart(u, cx = 0.32, cy = 0.40, s = 0.17) {
  const t = 2 * Math.PI * u;
  const x = 16 * Math.sin(t) ** 3;
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  return [cx + (x / 16) * s * 0.75, cy - (y / 16) * s];
}
function star(u, cx = 0.70, cy = 0.40, s = 0.17) {
  const pts = [];
  for (let k = 0; k <= 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? s * 0.45 : s;
    pts.push([cx + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r]);
  }
  const seg = Math.min(u * 10, 9.999), i = Math.floor(seg), f = seg - i;
  return lerp(pts[i], pts[i + 1], f);
}
const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
const CENTER = [0.5, 0.45];

// the demo script: [pose, seconds, fingertip path, caption]
const SCRIPT = [
  ["hover", 1.0, () => heart(0),                   "moving to start"],
  ["draw",  5.0, u => heart(u),                    "drawing a heart"],
  ["hover", 1.2, u => lerp(heart(1), star(0), u),  "moving (pen up)"],
  ["draw",  4.0, u => star(u),                     "drawing a star"],
  ["hover", 0.8, () => star(1),                    "pen up"],
  ["fist",  1.0, u => lerp(star(1), CENTER, u),    "pausing"],
  ["palm",  1.8, () => CENTER,                     "holding palm to clear"],
];
const TOTAL = SCRIPT.reduce((s, step) => s + step[1], 0);

function gauss(sd) {   // sensor noise, so the twin sees realistic jitter
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random()) * sd;
}

function frameAt(seconds) {
  let t = seconds % TOTAL;
  for (const [pose, dur, path, caption] of SCRIPT) {
    if (t <= dur) {
      const tip = path(t / dur);
      const wrist = [tip[0], tip[1] + 0.40];        // place the hand so the index tip sits on the path
      const off = POSES[pose];
      const landmarks = Array.from({ length: 21 }, (_, i) => [
        +(wrist[0] + off[i][0] + gauss(0.0015)).toFixed(4),
        +(wrist[1] + off[i][1] + gauss(0.0015)).toFixed(4),
        0,
      ]);
      return { caption, msg: { type: "hand", ts: Date.now(), landmarks, handedness: "Right",
                               mirrored: false, aspect: 4 / 3, fps: 30, rtt: null } };
    }
    t -= dur;
  }
}

let timer = null, t0 = 0;
function startSim() {
  setSource("simulation");
  t0 = performance.now();
  timer = setInterval(() => {
    const { caption, msg } = frameAt((performance.now() - t0) / 1000);
    $("simStatus").textContent = `Virtual hand is ${caption}`;
    ingest(msg, "simulation");
  }, 33);
  $("simBtn").textContent = "■ Stop simulation";
  $("simBtn").classList.add("active");
}
function stopSim() {
  clearInterval(timer); timer = null;
  $("simBtn").textContent = "▶ Simulate hand";
  $("simBtn").classList.remove("active");
  $("simStatus").textContent = "";
}

$("simBtn").onclick = () => (timer ? setSource("phone") : startSim());
on("source", s => { if (s !== "simulation" && timer) stopSim(); });
