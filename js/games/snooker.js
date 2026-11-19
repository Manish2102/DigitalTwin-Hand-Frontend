// Snooker Coach - the table's digital twin plays your shot forward and shows the first contact, what goes in,
// and where every ball stops, live as you aim. Point behind the white ball, pinch to play.
// Physical sensor: the laptop camera.

import { W, H, C, text, roundRect, circle, cursor, clamp, lerp } from "./engine.js";
import { step, moving, predict } from "./physics.js";

const SHOTS = 15;
const T = { w: 2, h: 1, wall: 0.8, e: 0.95, decel: 0.08, drag: 0.7, stop: 0.01, pr: 0.05,
            pockets: [{ x: 0.03, y: 0.03 }, { x: 1, y: 0.015 }, { x: 1.97, y: 0.03 }, { x: 0.03, y: 0.97 }, { x: 1, y: 0.985 }, { x: 1.97, y: 0.97 }] };
const COLORS = { red: ["#c81e2a", 1], yellow: ["#f3d33b", 2], green: ["#1f8a4c", 3], brown: ["#7a4a24", 4],
                 blue: ["#2453c9", 5], pink: ["#f08fb0", 6], black: ["#141414", 7] };
const TW = 820, TH = 410, TX = (W - TW) / 2, TY = 61, SC = TW / 2;   // table on the screen; SC = pixels per table unit
const AIM_DELAY = 130;
const BALL_R = 0.026;

const toT = q => ({ x: (q.x * W - TX) / SC, y: (q.y * H - TY) / SC });
const say = (s, t) => { s.msg = t; s.msgT = 2; };
const shotSpeed = pw => 0.6 + pw * 3.6;

function rack() {
  const r = BALL_R, B = [{ id: 0, kind: "cue", x: 0.42, y: 0.55, vx: 0, vy: 0, r, m: 1, alive: true }];
  let id = 1;
  for (const [k, x, y] of [["yellow", 0.42, 0.68], ["green", 0.42, 0.32], ["brown", 0.42, 0.5], ["blue", 1, 0.5], ["pink", 1.45, 0.5], ["black", 1.82, 0.5]])
    B.push({ id: id++, kind: k, x, y, vx: 0, vy: 0, r, m: 1, alive: true, spot: { x, y } });
  for (let row = 0; row < 4; row++) for (let c = 0; c <= row; c++)
    B.push({ id: id++, kind: "red", x: 1.5 + row * r * 1.75, y: 0.5 + (c - row / 2) * r * 2.02, vx: 0, vy: 0, r, m: 1, alive: true });
  return B;
}
// put a coloured ball back on its spot, or the nearest free place towards the top cushion
function respot(s, b) {
  b.alive = true; b.vx = b.vy = 0;
  for (let k = 0; k < 40; k++) {
    const x = b.spot.x - k * 0.06, y = b.spot.y;
    if (!s.balls.some(o => o !== b && o.alive && Math.hypot(o.x - x, o.y - y) < o.r * 2.05)) { b.x = Math.max(0.1, x); b.y = y; return; }
  }
  b.x = b.spot.x; b.y = b.spot.y;
}

export default {
  id: "snooker", title: "Snooker Coach", icon: "snooker", sensor: "webcam", twinDemo: true,
  desc: "Aim with your hand and watch the table's twin forecast the shot: first contact, pots and in-offs. Fifteen shots.",
  modes: [{ id: "solo", label: "1 player", players: 1, scored: true }],
  phone: "Nothing to do on the phone: this one uses the laptop camera.",
  howto: ["Point your hand behind the white ball: the cue runs from your hand through the ball.",
          "Further away means more power. The coach bar tells you what the twin predicts.",
          "Pinch to play the shot. Red 1 point, colours 2 to 7, white in a pocket -4.",
          "Colours come back while reds are left. Fifteen shots. Mouse: move to aim, click to shoot."],
  twin: { entity: "The snooker table and your cue arm.", sensors: "The laptop camera: where your hand is and when you pinch.",
          model: "A physics copy of the table, simulated six seconds ahead several times a second.", loop: "Predicted paths, pots and fouls before you play." },

  init() { return { balls: rack(), state: "aim", shots: SHOTS, pots: 0, msg: "", msgT: 0, hist: [], pred: null, predT: 0, aim: null, potsThisShot: [] }; },

  update(g, s, dt) {
    s.msgT -= dt; s.predT -= dt;
    const q = g.ptr(), cue = s.balls[0];
    if (s.state === "aim") {
      if (q.source === "none") { s.aim = null; s.pred = null; return; }
      const p = toT(q), dx = cue.x - p.x, dy = cue.y - p.y, len = Math.hypot(dx, dy);
      const pw = clamp((len - 0.06) / 0.6, 0.04, 1);
      s.aim = { dx: dx / (len || 1), dy: dy / (len || 1), pw };
      const now = performance.now();
      s.hist.push({ t: now, ...s.aim });
      while (s.hist.length > 1 && now - s.hist[1].t > AIM_DELAY) s.hist.shift();
      if (s.predT <= 0) { const v = shotSpeed(pw); s.pred = predict(s.balls, T, 0, s.aim.dx * v, s.aim.dy * v, 6); s.predT = 0.08; }
      if (q.pinchStart) {
        const a = q.source === "mouse" ? s.aim : s.hist[0], v = shotSpeed(a.pw);
        cue.vx = a.dx * v; cue.vy = a.dy * v;
        s.state = "moving"; s.pred = null; s.potsThisShot = []; s.shots--; g.sfx("bounce");
      }
    } else {
      for (const e of step(s.balls, T, dt)) s.potsThisShot.push(e.ball);
      if (!moving(s.balls)) {
        let pts = 0;
        const redsLeft = s.balls.some(b => b.kind === "red" && b.alive);
        for (const b of s.potsThisShot) {
          if (b.kind === "cue") { pts -= 4; b.alive = true; b.x = 0.42; b.y = 0.5; b.vx = b.vy = 0; continue; }
          pts += COLORS[b.kind][1]; s.pots++;
          if (b.kind !== "red" && redsLeft) respot(s, b);
        }
        if (s.potsThisShot.length) { say(s, pts >= 0 ? `Potted +${pts}` : `Foul ${pts}`); g.sfx(pts >= 0 ? "good" : "bad"); g.buzz(1, [30]); }
        g.addScore(1, pts);
        s.state = "aim"; s.hist = [];
        if (!s.balls.some(b => b.kind !== "cue" && b.alive)) return g.end({ title: "Table cleared", detail: `${s.pots} balls potted.` });
        if (s.shots <= 0) return g.end({ title: "Out of shots", detail: `${s.pots} ball${s.pots === 1 ? "" : "s"} potted.` });
      }
    }
  },

  draw(g, s) {
    const c = g.ctx, q = g.ptr();
    c.fillStyle = C.bg; c.fillRect(0, 0, W, H);
    c.save(); c.translate(TX, TY);
    roundRect(-SC * 0.06, -SC * 0.06, TW + SC * 0.12, TH + SC * 0.12, SC * 0.04, "#4a2a14");
    const grad = c.createRadialGradient(TW / 2, TH / 2, 10, TW / 2, TH / 2, TW * 0.6);
    grad.addColorStop(0, "#1f8a4c"); grad.addColorStop(1, "#146238");
    c.fillStyle = grad; c.fillRect(0, 0, TW, TH);
    c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0.42 * SC, 0); c.lineTo(0.42 * SC, TH); c.stroke();
    c.beginPath(); c.arc(0.42 * SC, 0.5 * SC, 0.18 * SC, Math.PI / 2, Math.PI * 1.5); c.stroke();
    for (const p of T.pockets) circle(p.x * SC, p.y * SC, T.pr * SC, "#050505");
    const P = s.pred;
    if (P && s.state === "aim") {
      for (const id in P.paths) {
        const pth = P.paths[id];
        if (pth.length < 2) continue;
        const b = s.balls.find(x => x.id == id), col = b.kind === "cue" ? "rgba(255,255,255,.85)" : COLORS[b.kind][0];
        c.strokeStyle = col; c.lineWidth = 2; c.setLineDash(b.kind === "cue" ? [6, 6] : []);
        c.beginPath(); pth.forEach((x, k) => k ? c.lineTo(x.x * SC, x.y * SC) : c.moveTo(x.x * SC, x.y * SC)); c.stroke(); c.setLineDash([]);
        const f = P.final.find(x => x.id == id);
        if (f && f.alive) { c.globalAlpha = 0.6; circle(f.x * SC, f.y * SC, b.r * SC, null, b.kind === "cue" ? "#fff" : col, 2); c.globalAlpha = 1; }
      }
      for (const pp of P.pots) circle(pp.pocket.x * SC, pp.pocket.y * SC, T.pr * SC * 1.35, null, pp.kind === "cue" ? "#ff4d4d" : "#ffe066", 3);
    }
    for (const b of s.balls) {
      if (!b.alive) continue;
      const x = b.x * SC, y = b.y * SC, r = b.r * SC;
      circle(x + r * 0.2, y + r * 0.25, r, "rgba(0,0,0,.3)");
      circle(x, y, r, b.kind === "cue" ? "#f7f3e8" : COLORS[b.kind][0]);
      circle(x - r * 0.35, y - r * 0.35, r * 0.3, "rgba(255,255,255,.45)");
    }
    if (s.state === "aim" && s.aim) {                                // the cue
      const cb = s.balls[0], a = s.aim, back = 0.05 + a.pw * 0.25;
      const x1 = (cb.x - a.dx * (cb.r + back)) * SC, y1 = (cb.y - a.dy * (cb.r + back)) * SC;
      const x2 = (cb.x - a.dx * (cb.r + back + 0.9)) * SC, y2 = (cb.y - a.dy * (cb.r + back + 0.9)) * SC;
      c.lineCap = "round"; c.lineWidth = SC * 0.014;
      c.strokeStyle = "#d9b27a"; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.strokeStyle = "#3b2a1a"; c.beginPath(); c.moveTo(lerp(x1, x2, 0.6), lerp(y1, y2, 0.6)); c.lineTo(x2, y2); c.stroke();
      c.lineCap = "butt";
    }
    c.restore();
    // coach bar
    const bw = 820, bx = (W - bw) / 2, by = H - 70;
    roundRect(bx, by, bw, 56, 10, C.surface, C.border);
    text("DIGITAL TWIN - SHOT FORECAST", bx + 16, by + 22, { size: 11, weight: 600, color: C.accent });
    text(`Score ${g.score[1]}  -  Shots ${s.shots}`, bx + bw - 16, by + 22, { size: 13, weight: 700, align: "right" });
    if (s.state === "aim" && P) {
      const good = P.pots.filter(p => p.kind !== "cue"), foul = P.pots.some(p => p.kind === "cue");
      const first = s.balls.find(b => b.id === P.firstHit);
      let x = bx + 16;
      const seg = (t, col) => { text(t, x, by + 44, { size: 13, weight: 500, color: col }); c.font = "500 13px Inter, system-ui, sans-serif"; x += c.measureText(t).width + 24; };
      seg(`First contact: ${first ? first.kind : "none"}`, first ? C.text : C.warn);
      seg(good.length ? `Predicted pot: ${good.map(x => x.kind).join(", ")}` : "No pot predicted, adjust the angle", good.length ? "#ffe066" : C.text3);
      seg(foul ? "Warning: the white goes in" : `Power ${(s.aim.pw * 100).toFixed(0)}%`, foul ? C.bad : C.text3);
    } else text(s.state === "aim" ? "Show a hand to the camera, or move the mouse over the table" : "Balls in motion...", bx + 16, by + 44, { size: 13, weight: 500, color: C.text2 });
    if (s.msgT > 0) {
      c.globalAlpha = clamp(s.msgT, 0, 1);
      roundRect(W / 2 - 130, TY + TH / 2 - 30, 260, 50, 12, "rgba(13,18,32,.85)");
      text(s.msg, W / 2, TY + TH / 2 + 4, { size: 24, weight: 700, color: "#ffe066", align: "center" });
      c.globalAlpha = 1;
    }
    cursor(q, "#ffe066");
  },
};
