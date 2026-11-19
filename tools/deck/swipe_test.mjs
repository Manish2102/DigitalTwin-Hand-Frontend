// Swipe detector tests with synthetic hands: run `node tools/deck/swipe_test.mjs` (exit code 1 if any fail).
import { SwipeDetector, handInfo } from "../../js/deck/swipe.js";

// synthetic hand: mirrored centre x (presenter's view), y, palm length L (frame-height units), open or fist
function hand(mx, y, L = 0.12, open = true, asp = 4 / 3) {
  const cx = 1 - mx, w = L / asp;                       // raw camera x
  const p = Array.from({ length: 21 }, () => [cx, y, 0]);
  p[0] = [cx, y + L * 0.55, 0];
  const mcp = [[5, -0.36], [9, -0.12], [13, 0.12], [17, 0.34]];
  for (const [i, o] of mcp) p[i] = [cx + o * w, y - L * 0.45, 0];
  p[1] = [cx - 0.5 * w, y + 0.3 * L, 0]; p[2] = [cx - 0.7 * w, y + 0.1 * L, 0]; p[3] = [cx - 0.85 * w, y - 0.05 * L, 0]; p[4] = [cx - 0.95 * w, y - 0.2 * L, 0];
  for (const [mcpI, o] of mcp) {
    const x = cx + o * w;
    if (open) { p[mcpI + 1] = [x, y - L * 0.75, 0]; p[mcpI + 2] = [x, y - L * 0.95, 0]; p[mcpI + 3] = [x, y - L * 1.15, 0]; }
    else { p[mcpI + 1] = [x, y - L * 0.6, 0]; p[mcpI + 2] = [x, y - L * 0.3, 0]; p[mcpI + 3] = [x, y - L * 0.2, 0]; }
  }
  return p;
}
const rnd = (a) => (Math.random() - 0.5) * a;
function run(name, frames, opts = {}) {
  const d = new SwipeDetector(opts); const out = [];
  for (const f of frames) { const r = d.update(f.t, f.hands); if (r) out.push(`${r}@${f.t}`); }
  return [name, out];
}
const FPS = 30, dt = 1000 / FPS;
function seq(fn, ms, t0 = 0) { const fr = []; for (let t = 0; t <= ms; t += dt) fr.push({ t: t0 + t, hands: fn(t) }); return fr; }
const still = (ms, x = 0.5, t0 = 0, j = 0.006, y = 0.5) => seq(() => [hand(x + rnd(j), y + rnd(j))], ms, t0);
const move = (x0, x1, ms, t0, open = true, L = 0.12, y0 = 0.5, y1 = 0.5) => seq(t => [hand(x0 + (x1 - x0) * Math.min(1, t / ms) + rnd(0.004), y0 + (y1 - y0) * Math.min(1, t / ms), L, open)], ms, t0);
const cat = (...parts) => { let t = 0, all = []; for (const p of parts) { const sh = p.map(f => ({ ...f, t: f.t + t })); all = all.concat(sh); t = sh[sh.length - 1].t + dt; } return all; };

const tests = [
  ["still hand with jitter (10 s)", still(10000), 0],
  ["slow drift right over 3 s", cat(still(500, 0.3), move(0.3, 0.7, 3000, 0)), 0],
  ["tracking glitch: hand jumps across in one frame", cat(still(800, 0.3), still(800, 0.75)), 0],
  ["two hands swap (closest hand changes)", cat(seq(() => [hand(0.3, 0.5, 0.12), hand(0.75, 0.5, 0.115)], 800), seq(() => [hand(0.3, 0.5, 0.11), hand(0.75, 0.5, 0.125)], 800)), 0],
  ["swipe right (fast)", cat(still(600, 0.35), move(0.35, 0.75, 300, 0), still(800, 0.75)), "right"],
  ["swipe left (fast)", cat(still(600, 0.7), move(0.7, 0.3, 300, 0), still(800, 0.3)), "left"],
  ["swipe right then hand returns", cat(still(600, 0.3), move(0.3, 0.72, 300, 0), still(250, 0.72), move(0.72, 0.3, 400, 0), still(1500, 0.3)), "right"],
  ["two swipes right 2 s apart (repositioning between)", cat(still(600, 0.3), move(0.3, 0.72, 300, 0), still(300, 0.72), seq(() => [], 600), still(1200, 0.3), move(0.3, 0.72, 300, 0), still(600, 0.72)), "right,right"],
  ["hand enters frame moving sideways", cat(seq(() => [], 500), move(0.05, 0.6, 300, 0), still(800, 0.6)), 0],
  ["fist swipe (closed hand)", cat(still(600, 0.3), move(0.3, 0.75, 300, 0, false), still(600, 0.75)), 0],
  ["vertical movement", cat(still(600, 0.5), seq(t => [hand(0.5 + rnd(0.004), 0.3 + 0.4 * Math.min(1, t / 300))], 300), still(600)), 0],
  ["diagonal (45 degrees)", cat(still(600, 0.3), move(0.3, 0.6, 300, 0, true, 0.12, 0.5, 0.85), still(600, 0.6, 0, 0.006, 0.85)), 0],
  ["far presenter: small hand, short swipe", cat(still(600, 0.4), move(0.4, 0.62, 300, 0, true, 0.06), still(600, 0.62)), "right"],
  ["far presenter: tiny nudge", cat(still(600, 0.4), move(0.4, 0.47, 200, 0, true, 0.06), still(600, 0.47)), 0],
  ["gesturing while talking (small fast waves)", cat(still(600), ...Array.from({ length: 8 }, (_, k) => move(k % 2 ? 0.58 : 0.42, k % 2 ? 0.42 : 0.58, 250, 0))), 0],
];
let pass = 0;
for (const [name, frames, want] of tests) {
  const [, got] = run(name, frames);
  const g = got.map(s => s.split("@")[0]).join(",") || 0;
  const ok = String(g) === String(want);
  if (ok) pass++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: expected ${want}, got ${g} ${got.length ? "(" + got.join(" ") + ")" : ""}`);
}
console.log(`${pass}/${tests.length} passed`);
const h = handInfo(hand(0.5, 0.5)); console.log("open hand detected:", h.open, " fist detected open:", handInfo(hand(0.5, 0.5, 0.12, false)).open);
process.exit(pass === tests.length ? 0 : 1);
