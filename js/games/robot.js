// Robot Arm Twin - teleoperate a two-joint robot arm with your hand. The arm follows the hand by inverse
// kinematics, pinch closes the gripper, and the joint angles on the right are what a real servo arm would be sent.
// Physical sensor: the laptop camera.

import { W, H, C, text, roundRect, circle, clamp, lerp } from "./engine.js";

const TIME = 90;
const U = H / 100;                                  // world units -> pixels (the world is 100 units high)
const WW = W / U, BASE = Math.max(58, WW * 0.42), BY = 76, L1 = 30, L2 = 26, FLOOR = 88;
const RATE = 4;                                     // rad/s: real servos cannot jump, so the twin cannot either
const COLS = ["#ef4444", "#3b82f6", "#22c55e"];
const BINS = [24, 37, 50].map((x, c) => ({ c, x: BASE + x, col: COLS[c] }));
const X = v => v * U;
const say = (s, t) => { s.msg = t; s.msgT = 1.5; };

function landed(g, s, b) {
  const bin = BINS.find(q => Math.abs(q.x - b.x) < 5.5);
  if (!bin || b.done) return;
  if (bin.c === b.c) {
    b.done = true; s.sorted++; g.addScore(1, 100); g.sfx("good"); g.buzz(1, [30]);
    say(s, s.sorted === 6 ? "All sorted" : "Sorted +100");
  } else { g.addScore(1, -20); g.sfx("bad"); say(s, "Wrong bin -20"); }
}

export default {
  id: "robot", title: "Robot Arm Twin", icon: "bot", sensor: "webcam", twinDemo: true,
  desc: "Drive a robot arm with your hand. Pinch to grip, sort each block into the bin of the same colour before time runs out.",
  modes: [{ id: "sort", label: "1 player", players: 1, scored: true }],
  phone: "Nothing to do on the phone: this one uses the laptop camera.",
  howto: ["The gripper follows your hand. The dashed arc is how far the arm can reach.",
          "Pinch to close the gripper on a block, open your fingers to drop it.",
          "Drop each block into the bin of its colour: +100, wrong bin -20.",
          "90 seconds; time left is a bonus when all six are sorted. Mouse: hold the button to grip."],
  twin: { entity: "Your hand, and a robot arm it controls.", sensors: "The laptop camera: hand position and pinch, 30 times a second.",
          model: "Inverse kinematics turns the hand position into two joint angles, rate-limited like real servos.", loop: "The arm moves; the telemetry is what you would stream to a real arm (ESP32, ROS 2)." },

  init() {
    const blocks = [0, 1, 2, 0, 1, 2].map((c, k) => ({ c, col: COLS[c], x: BASE - 44 + (k % 3) * 11, y: 84.5 - (k > 2 ? 7 : 0), vy: 0, done: false }));
    return { a1: -1.2, a2: 1.4, grip: 0, held: null, sorted: 0, msg: "", msgT: 0, hist: [], blocks, E: { x: BASE, y: BY - 40 }, tgt: null };
  },

  update(g, s, dt) {
    s.msgT -= dt;
    const q = g.ptr();
    if (g.time >= TIME) return g.end({ title: "Time is up", detail: `${s.sorted} of 6 blocks sorted.` });
    // target relative to the shoulder, clamped to what the arm can reach
    let tx = q.x * WW - BASE, ty = Math.min(q.y * 100, 86) - BY;
    let d = Math.hypot(tx, ty);
    const max = L1 + L2 - 0.5, min = Math.abs(L1 - L2) + 1;
    if (d > max) { tx *= max / d; ty *= max / d; d = max; }
    if (d < min) { tx *= min / (d || 1); ty *= min / (d || 1); d = min; }
    s.tgt = { x: BASE + tx, y: BY + ty };
    const c2 = clamp((d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1), t2 = -Math.acos(c2);
    const t1 = Math.atan2(ty, tx) - Math.atan2(L2 * Math.sin(t2), L1 + L2 * Math.cos(t2));
    const stepA = RATE * dt, mv = (a, b) => { let dd = b - a; while (dd > Math.PI) dd -= 2 * Math.PI; while (dd < -Math.PI) dd += 2 * Math.PI; return a + clamp(dd, -stepA, stepA); };
    if (q.source !== "none") { s.a1 = mv(s.a1, t1); s.a2 = mv(s.a2, t2); }
    s.grip = lerp(s.grip, q.pinch ? 1 : 0, 0.25);
    const ex = BASE + L1 * Math.cos(s.a1) + L2 * Math.cos(s.a1 + s.a2), ey = BY + L1 * Math.sin(s.a1) + L2 * Math.sin(s.a1 + s.a2);
    s.E = { x: ex, y: ey };
    const gp = { x: ex, y: ey + 7 };
    if (q.pinchStart && !s.held) {
      let best = null, bd = 6.5;
      for (const b of s.blocks) { if (b.done) continue; const dd = Math.hypot(b.x - gp.x, b.y - gp.y); if (dd < bd) { bd = dd; best = b; } }
      if (best) { s.held = best; g.sfx("tick"); }
    }
    if (s.held && !q.pinch) { s.held.vy = 0; s.held = null; }
    if (s.held) { s.held.x = gp.x; s.held.y = gp.y; s.held.vy = 0; }
    for (const b of s.blocks) {                       // gravity and stacking
      if (b === s.held) continue;
      let sup = FLOOR;
      for (const o of s.blocks) if (o !== b && o !== s.held && Math.abs(o.x - b.x) < 6.3 && o.y > b.y) sup = Math.min(sup, o.y - 3.5);
      b.vy += 160 * dt; b.y += b.vy * dt;
      if (b.y + 3.5 >= sup) { if (b.vy > 20) landed(g, s, b); b.y = sup - 3.5; b.vy = 0; }
    }
    s.hist.push([s.a1, s.a2, s.grip]);
    if (s.hist.length > 160) s.hist.shift();
    if (s.sorted === 6) {
      const bonus = Math.round((TIME - g.time) * 2);
      g.addScore(1, bonus);
      return g.end({ title: "All sorted", detail: `Done in ${g.time.toFixed(1)} s, time bonus +${bonus}.` });
    }
  },

  draw(g, s) {
    const c = g.ctx, q = g.ptr();
    const bgr = c.createLinearGradient(0, 0, 0, H); bgr.addColorStop(0, "#0e1626"); bgr.addColorStop(1, "#141d30");
    c.fillStyle = bgr; c.fillRect(0, 0, W, H);
    c.strokeStyle = "rgba(124,140,255,.07)"; c.lineWidth = 1;
    for (let x = 0; x < W; x += X(5)) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, X(FLOOR)); c.stroke(); }
    for (let y = 0; y < X(FLOOR); y += X(5)) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.fillStyle = "#1c2638"; c.fillRect(0, X(FLOOR), W, H - X(FLOOR)); c.fillStyle = "#2b3954"; c.fillRect(0, X(FLOOR), W, 2);
    c.strokeStyle = "rgba(77,225,193,.14)"; c.setLineDash([4, 6]);
    c.beginPath(); c.arc(X(BASE), X(BY), X(L1 + L2), Math.PI, 2 * Math.PI); c.stroke(); c.setLineDash([]);
    for (const b of BINS) {
      const x = X(b.x);
      c.fillStyle = b.col + "22"; c.fillRect(x - X(5.5), X(80), X(11), X(8));
      c.strokeStyle = b.col; c.lineWidth = 3; c.beginPath();
      c.moveTo(x - X(5.5), X(80)); c.lineTo(x - X(5.5), X(FLOOR)); c.lineTo(x + X(5.5), X(FLOOR)); c.lineTo(x + X(5.5), X(80)); c.stroke();
    }
    for (const b of s.blocks) {
      roundRect(X(b.x - 3.5), X(b.y - 3.5), X(7), X(7), 3, b.col);
      if (b.done) { c.strokeStyle = "#fff"; c.lineWidth = 2.5; c.beginPath(); c.moveTo(X(b.x - 1.6), X(b.y)); c.lineTo(X(b.x - 0.4), X(b.y + 1.3)); c.lineTo(X(b.x + 1.8), X(b.y - 1.3)); c.stroke(); }
    }
    const sx = X(BASE), sy = X(BY), jx = X(BASE + L1 * Math.cos(s.a1)), jy = X(BY + L1 * Math.sin(s.a1)), ex = X(s.E.x), ey = X(s.E.y);
    roundRect(sx - X(7), sy, X(14), X(12), 6, "#2b3954");
    c.lineCap = "round";
    c.strokeStyle = "#cbd5e1"; c.lineWidth = X(3.2); c.beginPath(); c.moveTo(sx, sy); c.lineTo(jx, jy); c.stroke();
    c.strokeStyle = "#94a3b8"; c.lineWidth = X(2.5); c.beginPath(); c.moveTo(jx, jy); c.lineTo(ex, ey); c.stroke();
    c.lineCap = "butt";
    for (const [x, y, r] of [[sx, sy, 2.6], [jx, jy, 2.1], [ex, ey, 1.6]]) { circle(x, y, X(r), "#4de1c1"); circle(x, y, X(r * 0.45), "#0e1626"); }
    const op = lerp(5.2, 3.6, s.grip);                // gripper (the wrist keeps it vertical)
    c.strokeStyle = "#e2e8f0"; c.lineWidth = X(1); c.beginPath();
    c.moveTo(ex, ey); c.lineTo(ex, ey + X(2.5));
    c.moveTo(ex - X(op), ey + X(2.5)); c.lineTo(ex + X(op), ey + X(2.5));
    c.moveTo(ex - X(op), ey + X(2.5)); c.lineTo(ex - X(op), ey + X(10));
    c.moveTo(ex + X(op), ey + X(2.5)); c.lineTo(ex + X(op), ey + X(10)); c.stroke();
    if (q.source !== "none") circle(q.x * W, Math.min(q.y, 0.86) * H, 8, null, q.pinch ? C.ok : "rgba(77,225,193,.5)", 2);
    // telemetry
    const tx = W - 270, ty = 16;
    roundRect(tx, ty, 254, 168, 10, "rgba(13,18,32,.9)", C.border);
    text("TELEMETRY TO THE ROBOT - 30 Hz", tx + 14, ty + 20, { size: 11, weight: 600, color: C.accent });
    const deg = a => `${(a * 180 / Math.PI).toFixed(0)} deg`.padStart(8);
    c.font = "500 12px ui-monospace, monospace"; c.fillStyle = C.text; c.textAlign = "left";
    c.fillText(`J1 shoulder ${deg(-s.a1)}`, tx + 14, ty + 42);
    c.fillText(`J2 elbow    ${deg(-s.a2)}`, tx + 14, ty + 60);
    c.fillText(`Gripper     ${(s.grip * 100).toFixed(0).padStart(4)} %`, tx + 14, ty + 78);
    const gx = tx + 14, gy = ty + 92, gw = 226, gh = 60;
    c.strokeStyle = C.border; c.lineWidth = 1; c.strokeRect(gx, gy, gw, gh);
    for (const [col, i, lo, hi] of [["#4de1c1", 0, -Math.PI, Math.PI], ["#7c8cff", 1, -Math.PI, Math.PI], ["#ffb547", 2, 0, 1]]) {
      c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath();
      s.hist.forEach((h, k) => { const x = gx + k / 160 * gw, y = gy + gh - (h[i] - lo) / (hi - lo) * gh; k ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke();
    }
    roundRect(tx, ty + 176, 254, 40, 10, "rgba(13,18,32,.9)", C.border);
    text(`Sorted ${s.sorted} / 6`, tx + 14, ty + 202, { size: 16, weight: 700 });
    text(`${Math.max(0, TIME - g.time).toFixed(0)} s`, tx + 240, ty + 202, { size: 16, weight: 700, color: TIME - g.time < 15 ? C.bad : C.text2, align: "right" });
    if (s.msgT > 0) {
      c.globalAlpha = clamp(s.msgT, 0, 1);
      text(s.msg, W / 2 - 100, X(18), { size: 28, weight: 700, color: "#4de1c1", align: "center" });
      c.globalAlpha = 1;
    }
    if (q.source === "none") text("Show a hand to the camera, or use the mouse", 24, 30, { size: 14, color: C.text2 });
  },
};
