// Flick Carrom - pinch the striker, pull back like a catapult, let go to strike. Before you shoot, the board's
// digital twin plays the shot forward and draws where every coin will go. Physical sensor: the laptop camera.

import { W, H, C, text, roundRect, circle, cursor, clamp } from "./engine.js";
import { step, moving, predict } from "./physics.js";

const SHOTS = 10;
const T = { w: 1, h: 1, wall: 0.7, e: 0.9, decel: 0.16, drag: 0.5, stop: 0.012, pr: 0.042,
            pockets: [{ x: 0.035, y: 0.035 }, { x: 0.965, y: 0.035 }, { x: 0.035, y: 0.965 }, { x: 0.965, y: 0.965 }] };
const S = 552, BX = (W - S) / 2, BY = (H - S) / 2;     // board square on the screen
const BASE_Y = 0.82, MAX_V = 3.4;
const AIM_DELAY = 150;                                  // ms: opening the fingers moves the hand, so aim with where it was just before
const POINTS = { white: 1, black: 1, queen: 3 };
// How the hand becomes a shot (tuned so small hand jitter does nothing and full power needs a deliberate pull):
const DEAD = 26;                                        // px of pull that count as nothing (hand tremor, the pinch itself)
const SETTLE = 0.18;                                    // s after the pinch: the grab point settles while the fingers close
const MIN_PW = 0.08;                                    // less power than this on release cancels the shot
const SENS = [                                          // pull (px on the 960 x 600 board view) needed for full power
  { label: "Gentle", pull: 320 }, { label: "Normal", pull: 230 }, { label: "Quick", pull: 160 }];
const POWER_CURVE = 1.4;                                // power = pull^1.4: fine control for soft shots
const AIM_SMOOTH = 0.25;                                // per tick: the aim direction follows the hand calmly
const SLIDE_SMOOTH = 0.3;                               // per tick: the striker follows the hand calmly
const SENS_BTN = { x: 12, y: 102, w: 164, h: 44 };      // the pinchable sensitivity button (screen pixels)
const SENS_KEY = "dtl.carromSens";
const loadSens = () => { try { const v = +localStorage.getItem(SENS_KEY); return v >= 0 && v < SENS.length && localStorage.getItem(SENS_KEY) !== null ? v : 1; } catch { return 1; } };
const inBtn = q => { const x = q.x * W, y = q.y * H; return x >= SENS_BTN.x && x <= SENS_BTN.x + SENS_BTN.w && y >= SENS_BTN.y && y <= SENS_BTN.y + SENS_BTN.h; };

const say = (s, t) => { s.msg = t; s.msgT = 1.8; };

function rack() {
  const B = [{ id: 0, kind: "striker", x: 0.5, y: BASE_Y, vx: 0, vy: 0, r: 0.037, m: 1.7, alive: true }];
  let id = 1;
  B.push({ id: id++, kind: "queen", x: 0.5, y: 0.5, vx: 0, vy: 0, r: 0.028, m: 1, alive: true });
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; B.push({ id: id++, kind: k % 2 ? "black" : "white", x: 0.5 + Math.cos(a) * 0.057, y: 0.5 + Math.sin(a) * 0.057, vx: 0, vy: 0, r: 0.028, m: 1, alive: true }); }
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2 + Math.PI / 12; B.push({ id: id++, kind: k % 2 ? "white" : "black", x: 0.5 + Math.cos(a) * 0.114, y: 0.5 + Math.sin(a) * 0.114, vx: 0, vy: 0, r: 0.028, m: 1, alive: true }); }
  return B;
}
const coinsLeft = s => s.balls.filter(b => b.alive && b.kind !== "striker").length;
const blockedAt = (s, x) => s.balls.some(b => b.alive && b.kind !== "striker" && Math.hypot(b.x - x, b.y - BASE_Y) < b.r + 0.037 + 0.004);

export default {
  id: "carrom", title: "Flick Carrom", icon: "carrom", sensor: "webcam",
  desc: "Pinch the striker, pull back, let go. The board's twin predicts where every coin goes before you shoot. Ten shots.",
  modes: [{ id: "solo", label: "1 player", players: 1, scored: true }],
  phone: "Nothing to do on the phone: this one uses the laptop camera.",
  howto: ["Move your hand left and right to slide the striker along the baseline.",
          "Pinch anywhere, then pull your hand back like a catapult: the arrow shows the shot, the bar shows the power. Open your fingers to strike.",
          "Too twitchy? Pinch the Aim sensitivity button (or press S): Gentle needs a longer pull for full power.",
          "Dotted lines are the predicted shot: green coins go in, red means the striker falls in. Coin +1, queen +3, striker in -1, clearing the board +5."],
  twin: { entity: "Your hand and the carrom board.", sensors: "The laptop camera: hand position and pinch.",
          model: "A rigid-body simulation of the board, run ahead every frame to forecast the shot.", loop: "The forecast lines show the outcome before you commit." },

  init() {
    return { balls: rack(), state: "place", shots: SHOTS, msg: "", msgT: 0, pred: null, predOn: true, predT: 0, aim: null, hist: [], blocked: false,
             sens: loadSens(), anchor: null, dir: null, overBtn: false };
  },
  key(g, s, e) {
    const k = e.key.toLowerCase();
    if (k === "p") { s.predOn = !s.predOn; s.pred = null; }
    if (k === "s") cycleSens(s);
  },

  update(g, s, dt) {
    s.msgT -= dt; s.predT -= dt;
    const q = g.ptr(), st = s.balls[0];
    s.overBtn = q.source !== "none" && inBtn(q);
    if (s.state === "place") {
      // the whole left-right range of the hand (the middle 70 % of the view) slides the striker along the baseline
      if (q.source !== "none" && !s.overBtn) {
        const tx = 0.2 + clamp((q.x - 0.15) / 0.7, 0, 1) * 0.6;
        st.x += (tx - st.x) * (q.source === "mouse" ? 1 : SLIDE_SMOOTH);
      }
      st.y = BASE_Y; s.pred = null;
      s.blocked = blockedAt(s, st.x);
      if (q.pinchStart && s.overBtn) { cycleSens(s); g.sfx("tick"); }
      else if (q.pinchStart && !s.blocked && q.source !== "none") {
        s.state = "aim"; s.hist = []; s.anchor = { x: q.x * W, y: q.y * H }; s.dir = null; s.aimT = 0; s.aim = { dx: 0, dy: -1, pw: 0 };
      }
    } else if (s.state === "aim") {
      // pull is measured from where you pinched, not from the striker: pinch anywhere, pull back, let go
      s.aimT += dt;
      if (s.aimT < SETTLE && q.source !== "mouse") s.anchor = { x: q.x * W, y: q.y * H };
      const px = s.anchor.x - q.x * W, py = s.anchor.y - q.y * H, len = Math.hypot(px, py);
      const pw = Math.pow(clamp((len - DEAD) / (SENS[s.sens].pull - DEAD), 0, 1), POWER_CURVE);
      if (len > DEAD) {
        const nx = px / len, ny = py / len;
        if (!s.dir) s.dir = { x: nx, y: ny };
        else { const k = q.source === "mouse" ? 1 : AIM_SMOOTH; s.dir.x += (nx - s.dir.x) * k; s.dir.y += (ny - s.dir.y) * k; }
      }
      const d = s.dir ?? { x: 0, y: -1 }, dl = Math.hypot(d.x, d.y) || 1;
      s.aim = { dx: d.x / dl, dy: d.y / dl, pw, pull: len };
      const now = performance.now();
      s.hist.push({ t: now, ...s.aim });
      while (s.hist.length > 1 && now - s.hist[1].t > AIM_DELAY) s.hist.shift();
      if (s.predOn && pw > MIN_PW && s.predT <= 0) {
        const v = pw * MAX_V;
        s.pred = predict(s.balls, T, 0, s.aim.dx * v, s.aim.dy * v, 4);
        s.predT = 0.08;
      } else if (pw <= MIN_PW) s.pred = null;
      if (!q.pinch) {
        const a = q.source === "mouse" ? s.aim : s.hist[0];
        if (a.pw > MIN_PW) {
          const v = a.pw * MAX_V;
          st.vx = a.dx * v; st.vy = a.dy * v;
          s.state = "moving"; s.shots--; s.pred = null; s.potted = 0; g.sfx("bounce");
        } else s.state = "place";
      }
    } else if (s.state === "moving") {
      for (const e of step(s.balls, T, dt)) {
        const k = e.ball.kind;
        if (k === "striker") { g.addScore(1, -1); say(s, "Foul: striker in, -1"); g.sfx("bad"); }
        else { g.addScore(1, POINTS[k]); s.potted++; say(s, k === "queen" ? "Queen +3" : `${k[0].toUpperCase() + k.slice(1)} coin +1`); g.sfx("good"); g.buzz(1, [30]); }
      }
      if (!moving(s.balls)) {
        st.alive = true; st.vx = st.vy = 0; st.y = BASE_Y;
        if (coinsLeft(s) === 0) { g.addScore(1, 5); return g.end({ title: "Board cleared", detail: `Cleared with ${s.shots} shot${s.shots === 1 ? "" : "s"} to spare (+5).` }); }
        if (s.shots <= 0) return g.end({ title: "Out of shots", detail: `${19 - coinsLeft(s)} of 19 coins pocketed.` });
        s.state = "place";
      }
    }
  },

  draw(g, s) {
    const c = g.ctx, q = g.ptr();
    c.fillStyle = C.bg; c.fillRect(0, 0, W, H);
    c.save(); c.translate(BX, BY);
    roundRect(-S * 0.035, -S * 0.035, S * 1.07, S * 1.07, S * 0.03, "#3a2414");
    const grad = c.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.75);
    grad.addColorStop(0, "#f4dcae"); grad.addColorStop(1, "#d9b57b");
    c.fillStyle = grad; c.fillRect(0, 0, S, S);
    c.strokeStyle = "#5b3a1f"; c.lineWidth = 1.6;
    c.beginPath(); c.arc(S / 2, S / 2, S * 0.16, 0, 7); c.stroke();
    c.beginPath(); c.arc(S / 2, S / 2, S * 0.03, 0, 7); c.stroke();
    for (const [v, o] of [[0.82, "h"], [0.18, "h"], [0.18, "v"], [0.82, "v"]]) {
      c.beginPath();
      if (o === "h") { c.moveTo(S * 0.2, S * (v - 0.025)); c.lineTo(S * 0.8, S * (v - 0.025)); c.moveTo(S * 0.2, S * (v + 0.025)); c.lineTo(S * 0.8, S * (v + 0.025)); }
      else { c.moveTo(S * (v - 0.025), S * 0.2); c.lineTo(S * (v - 0.025), S * 0.8); c.moveTo(S * (v + 0.025), S * 0.2); c.lineTo(S * (v + 0.025), S * 0.8); }
      c.stroke();
    }
    for (const p of T.pockets) circle(p.x * S, p.y * S, T.pr * S, "#1a0f08");
    if (s.pred) {                                                   // the twin's forecast
      for (const id in s.pred.paths) {
        const pth = s.pred.paths[id];
        if (pth.length < 2) continue;
        const b = s.balls.find(x => x.id == id), in_ = s.pred.pots.some(x => x.id == id);
        c.strokeStyle = b.kind === "striker" ? "rgba(30,90,200,.9)" : b.kind === "queen" ? "rgba(214,49,58,.9)" : in_ ? "rgba(22,130,60,.95)" : "rgba(20,20,20,.3)";
        c.setLineDash([S * 0.008, S * 0.008]); c.lineWidth = S * 0.004;
        c.beginPath(); pth.forEach((x, k) => k ? c.lineTo(x.x * S, x.y * S) : c.moveTo(x.x * S, x.y * S)); c.stroke(); c.setLineDash([]);
      }
      for (const pp of s.pred.pots) circle(pp.pocket.x * S, pp.pocket.y * S, T.pr * S * 1.3, null, pp.kind === "striker" ? "#ff3b3b" : "#16a34a", S * 0.006);
    }
    for (const b of s.balls) {
      if (!b.alive) continue;
      const x = b.x * S, y = b.y * S, r = b.r * S;
      circle(x + r * 0.15, y + r * 0.2, r, "rgba(0,0,0,.25)");
      circle(x, y, r, b.kind === "white" ? "#f6eedd" : b.kind === "black" ? "#2a2522" : b.kind === "queen" ? "#d6313a" : "#e9f3ff");
      circle(x, y, r * 0.62, null, b.kind === "black" ? "#555" : "rgba(0,0,0,.25)", 1);
      if (b.kind === "striker") circle(x, y, r * 0.75, null, s.state === "place" && s.blocked ? C.bad : "#1e5ac8", 2);
    }
    if (s.state === "aim" && s.aim) {                              // shot arrow: direction and power
      const st = s.balls[0], x0 = st.x * S, y0 = st.y * S, L = 30 + s.aim.pw * 150;
      const x1 = x0 + s.aim.dx * L, y1 = y0 + s.aim.dy * L, a = Math.atan2(s.aim.dy, s.aim.dx);
      c.strokeStyle = s.aim.pw > MIN_PW ? "#1e5ac8" : "rgba(30,90,200,.35)"; c.lineWidth = 4; c.lineCap = "round";
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1);
      c.moveTo(x1, y1); c.lineTo(x1 - Math.cos(a - 0.5) * 14, y1 - Math.sin(a - 0.5) * 14);
      c.moveTo(x1, y1); c.lineTo(x1 - Math.cos(a + 0.5) * 14, y1 - Math.sin(a + 0.5) * 14); c.stroke(); c.lineCap = "butt";
      roundRect(x0 - 50, y0 + 26, 100, 8, 4, "rgba(0,0,0,.25)");    // power bar under the striker
      if (s.aim.pw > 0.01) roundRect(x0 - 50, y0 + 26, Math.max(8, 100 * s.aim.pw), 8, 4, s.aim.pw > 0.85 ? C.bad : s.aim.pw > 0.5 ? C.warn : C.ok);
      text(`Power ${(s.aim.pw * 100).toFixed(0)}%`, x0, y0 + 50, { size: 13, weight: 700, color: "#1e5ac8", align: "center" });
    }
    c.restore();
    if (s.state === "aim" && s.anchor && q.source !== "none") {    // the pull: from where you pinched to your hand now
      c.strokeStyle = "rgba(231,233,236,.55)"; c.lineWidth = 2; c.setLineDash([5, 5]);
      c.beginPath(); c.moveTo(s.anchor.x, s.anchor.y); c.lineTo(q.x * W, q.y * H); c.stroke(); c.setLineDash([]);
      circle(s.anchor.x, s.anchor.y, 5, "rgba(231,233,236,.7)");
    }
    // sensitivity button (pinch or click it while placing; S on the keyboard)
    const hot = s.overBtn && s.state === "place";
    roundRect(SENS_BTN.x, SENS_BTN.y, SENS_BTN.w, SENS_BTN.h, 10, hot ? C.s3 : C.surface, hot ? C.accent : C.border);
    text("AIM SENSITIVITY", SENS_BTN.x + 14, SENS_BTN.y + 18, { size: 10, weight: 600, color: C.text3 });
    text(SENS[s.sens].label, SENS_BTN.x + 14, SENS_BTN.y + 36, { size: 14, weight: 700 });
    SENS.forEach((_, k) => circle(SENS_BTN.x + SENS_BTN.w - 46 + k * 14, SENS_BTN.y + 31, 4, k <= s.sens ? C.accent : C.border2));
    // side panels
    roundRect(W - 176, 20, 164, 96, 10, C.surface, C.border);
    text("SCORE", W - 162, 42, { size: 11, weight: 600, color: C.text3 });
    text(String(g.score[1]), W - 162, 76, { size: 28, weight: 700 });
    text(`SHOTS ${s.shots}`, W - 24, 42, { size: 11, weight: 600, color: C.text3, align: "right" });
    text(`AI preview ${s.predOn ? "on" : "off"} (P)`, W - 162, 104, { size: 11, weight: 600, color: s.predOn ? C.ok : C.text3 });
    const tip = s.state === "place" ? (s.blocked ? "A coin is on the baseline here. Slide along." : "Slide, then pinch anywhere")
              : s.state === "aim" ? (s.aim?.pw > MIN_PW ? "Open fingers to shoot" : "Pull your hand back to aim") : "Coins moving...";
    roundRect(12, 20, 164, 70, 10, C.surface, C.border);
    text("NEXT", 26, 42, { size: 11, weight: 600, color: C.text3 });
    wrap(tip, 26, 62, 140, 13);
    if (s.msgT > 0) {
      c.globalAlpha = clamp(s.msgT, 0, 1);
      roundRect(W / 2 - 150, H / 2 - 30, 300, 52, 12, "rgba(13,18,32,.88)");
      text(s.msg, W / 2, H / 2 + 4, { size: 22, weight: 700, align: "center" });
      c.globalAlpha = 1;
    }
    cursor(q, "#1e5ac8");
  },
};

function cycleSens(s) {
  s.sens = (s.sens + 1) % SENS.length;
  try { localStorage.setItem(SENS_KEY, String(s.sens)); } catch {}
}

function wrap(t, x, y, w, size) {
  const words = t.split(" ");
  let line = "";
  for (const wd of words) {
    const test = line ? line + " " + wd : wd;
    if (test.length * size * 0.55 > w && line) { text(line, x, y, { size, weight: 500, color: C.text2 }); y += size + 4; line = wd; }
    else line = test;
  }
  if (line) text(line, x, y, { size, weight: 500, color: C.text2 });
}
