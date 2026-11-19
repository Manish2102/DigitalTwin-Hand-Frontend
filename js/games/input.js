// input.js - turns what the phone sends into simple per-player game input.
//
//   tx, ty     tilt in degrees, relative to the calibrated neutral pose
//              tx > 0: right edge down; ty > 0: top edge raised (like a ball-on-a-board: positive = rolls "down")
//   shake      strongest acceleration (m/s²) in the latest sensor message; shakeSeq counts messages
//   hand       true while a hand is visible; hx, hy = palm centre (0..1, un-mirrored, 0,0 = top-left)
//   tip        index fingertip [x, y] (0..1); tipSeq counts new hand frames
//   gesture    debounced hand shape: fist | palm | hover (index + middle) | draw (index only) | idle | none
//   ptr        a pointer for the camera games (see pollPointer): x, y (0..1, mirrored like a selfie view), pinch,
//              fist, open, pinchStart / pinchEnd (true for one tick), vx, vy, speed, hands, source
//
// Hand frames come from the phone camera, or from the laptop camera (camera.js calls feedHand). While the laptop
// camera is on, it is player 1's hand and the phone's hand frames for player 1 are ignored.
//
// Players: 1 = the normal phone, 2 = a second phone that joined with ?p=2.
// When a player's phone is not sending, the keyboard and mouse fill in so every game can be tried at a desk:
//   player 1: WASD / Space / keys 1-3 (rock, paper, scissors), mouse as the hand
//   player 2: arrow keys / Enter / keys 8-0

import { on, classify, fingersUp } from "../core.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DEG = 180 / Math.PI;
const LIVE_MS = 700;                       // a sensor counts as "live" if heard within this time

function blank() {
  return {
    tx: 0, ty: 0, up: [0, 0, 1], neutral: null,
    shake: 0, shakeSeq: 0,
    hand: false, hx: 0.5, hy: 0.5, tip: [0.5, 0.5], tipSeq: 0, gesture: "none",
    lastPose: 0, lastHand: 0,
    cand: "none", candN: 0,
    ptr: { x: 0.5, y: 0.5, pinch: false, fist: false, open: false, pinchStart: false, pinchEnd: false,
           vx: 0, vy: 0, speed: 0, hands: 0, source: "none",
           tx: 0.5, ty: 0.5, rawPinch: false, rawFist: false, rawOpen: false, relN: 0, seen: 0, lastLive: 0, hist: [] },
  };
}
export const inputs = { 1: blank(), 2: blank() };
export const poseLive = p => performance.now() - inputs[p].lastPose < LIVE_MS;
export const handLive = p => performance.now() - inputs[p].lastHand < LIVE_MS;
export const phoneLive = p => poseLive(p) || handLive(p);

// ------------------------------------------------------------------ tilt
// Euler angles break down when the phone is held upright (gimbal lock), so tilt is computed from the
// direction of "up" as the phone sees it - the third row of the rotation matrix. That stays smooth in any grip.
function upVector(beta, gamma) {
  const b = beta / DEG, g = gamma / DEG;
  return [-Math.cos(b) * Math.sin(g), Math.sin(b), Math.cos(b) * Math.cos(g)];
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const n = Math.hypot(...a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };

// Neutral pose: the grip the player has when the game starts. Two axes perpendicular to it measure the tilt.
function makeAxes(u0) {
  const ex = [1, 0, 0];
  const k = dot(ex, u0);
  const a = unit([ex[0] - k * u0[0], ex[1] - k * u0[1], ex[2] - k * u0[2]]);   // device "right", flattened
  return { u0, a, b: cross(u0, a) };
}
export function calibrate(p) {
  const i = inputs[p];
  i.neutral = makeAxes(i.up);
  i.tx = i.ty = 0;
}
function tiltFrom(i) {
  const n = i.neutral ?? (i.neutral = makeAxes(i.up));
  const d = [i.up[0] - n.u0[0], i.up[1] - n.u0[1], i.up[2] - n.u0[2]];
  return [-Math.asin(clamp(dot(d, n.a), -1, 1)) * DEG, Math.asin(clamp(dot(d, n.b), -1, 1)) * DEG];
}

// ----------------------------------------------------------------- hand
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Pinch, fist and open palm from one hand. Distances are divided by the palm length (wrist to middle knuckle),
// so they do not change when the hand moves closer to the camera. aspect = camera width / height, so that
// x and y distances are measured in the same units.
function pointerFrom(q, lm, aspect, hands) {
  const P = k => [lm[k][0] * aspect, lm[k][1]];
  const palm = dist2(P(0), P(9)) || 0.1;
  const pd = dist2(P(4), P(8)) / palm;                       // thumb tip to index tip
  if (!q.rawPinch) { q.rawPinch = pd < 0.33; q.relN = 0; }
  else if (pd > 0.55) { if (++q.relN >= 2) q.rawPinch = false; }   // two frames apart before letting go
  else q.relN = 0;
  const curl = [8, 12, 16, 20].reduce((t, k) => t + dist2(P(k), P(0)), 0) / 4 / palm;
  q.rawFist = curl < 1.05 && !q.rawPinch;
  q.rawOpen = curl > 1.55 && !q.rawPinch;
  // the pointer sits between the thumb and index tips; the comfortable middle of the camera view covers the whole screen
  const px = (lm[4][0] + lm[8][0]) / 2, py = (lm[4][1] + lm[8][1]) / 2;
  q.tx = clamp((px - 0.18) / 0.64, 0, 1);
  q.ty = clamp((py - 0.12) / 0.62, 0, 1);
  q.hands = hands; q.seen = performance.now();
}

function onHand(i, m) {
  i.lastHand = performance.now();
  if (!m.landmarks) { i.hand = false; i.gesture = "none"; i.cand = "none"; i.ptr.hands = 0; return; }
  const lm = m.mirrored ? m.landmarks.map(([x, y, z]) => [1 - x, y, z]) : m.landmarks;   // same flip as the hand twin
  pointerFrom(i.ptr, lm, m.aspect ?? 1, m.hands ?? 1);
  const centre = [(lm[0][0] + lm[9][0]) / 2, (lm[0][1] + lm[9][1]) / 2];
  i.hx += (centre[0] - i.hx) * 0.5; i.hy += (centre[1] - i.hy) * 0.5;
  if (!i.hand) { i.hx = centre[0]; i.hy = centre[1]; }
  i.hand = true;
  i.tip = [lm[8][0], lm[8][1]];                      // raw (not smoothed): the slicer needs the speed
  i.tipSeq++;
  const raw = classify(fingersUp(lm));
  if (raw === i.cand) i.candN++; else { i.cand = raw; i.candN = 1; }
  if (i.candN >= 3) i.gesture = raw;                 // 3 frames in a row, same debounce as the hand twin
}

function onPose(i, m) {
  i.lastPose = performance.now();
  if (m.beta == null || m.gamma == null) return;
  i.up = upVector(m.beta, m.gamma);
  const [tx, ty] = tiltFrom(i);
  i.tx += (tx - i.tx) * 0.5; i.ty += (ty - i.ty) * 0.5;
  i.shake = m.acc ?? 0;
  i.shakeSeq++;
}

let camActive = false;
export const setCameraActive = v => { camActive = v; if (!v) inputs[1].ptr.seen = 0; };
// the laptop camera's hand (camera.js): landmarks as MediaPipe returns them, or null when no hand is in view
export function feedHand(p, landmarks, { mirrored = true, aspect = 1, hands = 1 } = {}) {
  onHand(inputs[p], { landmarks, mirrored, aspect, hands });
}

on("raw", m => {
  const i = inputs[m.p];
  if (!i) return;
  if (m.type === "hand") { if (!(camActive && m.p === 1)) onHand(i, m); }
  else if (m.type === "pose") onPose(i, m);
});

// -------------------------------------------------- keyboard and mouse fallback
const KEYS = {
  1: { left: "a", right: "d", up: "w", down: "s", shake: " ", rock: "1", paper: "2", scissors: "3", fist: "b" },
  2: { left: "arrowleft", right: "arrowright", up: "arrowup", down: "arrowdown", shake: "enter", rock: "8", paper: "9", scissors: "0" },
};
const held = new Set();
let active = false;                                  // only react to keys while a game is on screen
export const setActive = v => { active = v; if (!v) held.clear(); };
window.addEventListener("keydown", e => {
  if (!active || e.target.closest?.("input, select, textarea")) return;
  const k = e.key.toLowerCase();
  if (Object.values(KEYS).some(m => Object.values(m).includes(k))) {
    e.preventDefault();
    if (!held.has(k)) for (const p of [1, 2]) if (k === KEYS[p].shake) inputs[p].kbShake = 1;
    held.add(k);
  }
});
window.addEventListener("keyup", e => held.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => held.clear());

const mouse = { x: 0.5, y: 0.5, seen: 0, down: false, downEvt: false };
export function mouseMove(nx, ny) { mouse.x = clamp(nx, 0, 1); mouse.y = clamp(ny, 0, 1); mouse.seen = performance.now(); }
export function mouseButton(down) {                  // a mouse click (or touch) is a pinch
  if (down) { mouse.down = true; mouse.downEvt = true; mouse.seen = performance.now(); } else mouse.down = false;
}

// ------------------------------------------------------------- pointer
// One pointer per player for the camera games, from the best source available:
// a hand seen in the last 350 ms (laptop or phone camera), else the mouse (player 1), else nothing.
const HAND_HOLD = 350, VEL_MS = 130;
function pollPointer(p, dt) {
  const i = inputs[p], q = i.ptr, now = performance.now();
  let tx = q.x, ty = q.y, pinch = false, fist = false, open = false, src = "none";
  if (now - q.seen < HAND_HOLD) {
    src = p === 1 && camActive ? "camera" : "phone";
    tx = q.tx; ty = q.ty; pinch = q.rawPinch; fist = q.rawFist; open = q.rawOpen;
  } else if (p === 1 && now - mouse.seen < 3000) {
    src = "mouse"; tx = mouse.x; ty = mouse.y; pinch = mouse.down || mouse.downEvt; fist = held.has("b");
  }
  if (p === 1) mouse.downEvt = false;
  const jump = src !== q.source || now - q.lastLive > 400;   // new source or hand just came back: no smoothing, no speed
  const a = jump || src === "mouse" ? 1 : 1 - Math.pow(0.45, dt * 60);
  q.x += (tx - q.x) * a; q.y += (ty - q.y) * a;
  if (src !== "none") q.lastLive = now;
  if (src === "mouse" || src === "none") q.hands = src === "none" && camActive ? q.hands : 0;
  q.source = src;
  q.pinchStart = pinch && !q.pinch; q.pinchEnd = !pinch && q.pinch;
  q.pinch = pinch; q.fist = fist; q.open = open;
  if (jump || (src === "mouse" && q.pinchStart)) q.hist.length = 0;   // a mouse drag's speed starts at the press
  q.hist.push({ t: now, x: q.x, y: q.y });
  while (q.hist.length && now - q.hist[0].t > VEL_MS) q.hist.shift();
  if (q.hist.length > 1) {
    const h0 = q.hist[0], h1 = q.hist[q.hist.length - 1], s = Math.max(0.016, (h1.t - h0.t) / 1000);
    q.vx = (h1.x - h0.x) / s; q.vy = (h1.y - h0.y) / s;
  } else q.vx = q.vy = 0;
  q.speed = Math.hypot(q.vx, q.vy * 0.625);            // screen widths per second (the game area is 960 x 600)
}

// Called once per game tick, before the game updates.
export function poll(dt) {
  for (const p of [1, 2]) {
    pollPointer(p, dt);
    const i = inputs[p], K = KEYS[p];
    if (!poseLive(p)) {
      const x = (held.has(K.right) ? 1 : 0) - (held.has(K.left) ? 1 : 0);
      const y = (held.has(K.down) ? 1 : 0) - (held.has(K.up) ? 1 : 0);
      i.tx += (x * 24 - i.tx) * Math.min(1, dt * 8);
      i.ty += (y * 24 - i.ty) * Math.min(1, dt * 8);
      if (i.kbShake) { i.shake = 16; i.shakeSeq++; i.kbShake = 0; } else i.shake *= 0.5;
    }
    if (!handLive(p)) {
      const g = held.has(K.rock) ? "fist" : held.has(K.paper) ? "palm" : held.has(K.scissors) ? "hover" : null;
      if (p === 1 && performance.now() - mouse.seen < 3000) {            // the mouse plays the hand for player 1
        const moved = Math.hypot(mouse.x - i.tip[0], mouse.y - i.tip[1]) > 1e-4;
        i.hand = true; i.hx += (mouse.x - i.hx) * 0.5; i.hy += (mouse.y - i.hy) * 0.5;
        i.tip = [mouse.x, mouse.y]; if (moved) i.tipSeq++;
        i.gesture = g ?? "draw";
      } else if (g) { i.hand = true; i.gesture = g; }
      else if (p === 1 || !handLive(p)) { i.hand = false; i.gesture = "none"; }
      // keyboard-only height control for the glider
      const dy = (held.has(K.down) ? 1 : 0) - (held.has(K.up) ? 1 : 0);
      if (dy && !(p === 1 && performance.now() - mouse.seen < 3000)) i.hy = clamp(i.hy + dy * dt * 0.9, 0, 1);
    }
  }
}

export function reset() {
  for (const p of [1, 2]) {
    const i = inputs[p];
    i.tx = i.ty = 0; i.shake = 0; i.neutral = null;
    i.ptr.pinch = i.ptr.pinchStart = i.ptr.pinchEnd = false; i.ptr.hist.length = 0;
    if (!handLive(p)) { i.hand = false; i.gesture = "none"; }
  }
}
