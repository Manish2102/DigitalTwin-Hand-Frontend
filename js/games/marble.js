// Marble Maze - tilt the phone like a wooden board to roll the marble to the goal. Avoid the holes.
// Physical sensor: orientation (tilt). The marble rolls "downhill", exactly as it would on the tilted phone.

import { W, H, C, text, hud, circle, grid } from "./engine.js";

export const LEVELS = [
  { start: [90, 510], goal: [870, 90],  holes: [[480, 300]] },
  { start: [90, 90],  goal: [870, 510], holes: [[260, 200], [420, 380], [600, 210], [740, 400], [520, 90]] },
  { start: [90, 510], goal: [870, 90],  holes: [[200, 420], [320, 290], [200, 170], [480, 470], [530, 200], [690, 330], [780, 170], [700, 510]] },
  { start: [90, 300], goal: [870, 300], holes: [[260, 150], [260, 450], [480, 300], [640, 140], [640, 460], [780, 300]],
    moving: [{ x: 360, y: 300, axis: "y", amp: 110, speed: 1.6 }, { x: 720, y: 220, axis: "x", amp: 60, speed: 1.2 }] },
  { start: [90, 510], goal: [870, 90],  holes: [[180, 370], [300, 150], [430, 430], [560, 270], [680, 470], [790, 300], [520, 90]],
    moving: [{ x: 320, y: 300, axis: "y", amp: 100, speed: 1.3 }, { x: 640, y: 150, axis: "x", amp: 110, speed: 1.1 }, { x: 860, y: 420, axis: "y", amp: 80, speed: 1.8 }] },
];
export const HOLE_R = 28, BALL_R = 14, GOAL_R = 24, LEVEL_TIME = 45;
const ACCEL = 55, FRICTION = 1.4, MAX_V = 720, FALL_AT = HOLE_R - 7;

const holesOf = (lv, t) => [
  ...lv.holes.map(([x, y]) => ({ x, y })),
  ...(lv.moving ?? []).map(m => {
    const o = Math.sin(t * m.speed) * m.amp;
    return { x: m.x + (m.axis === "x" ? o : 0), y: m.y + (m.axis === "y" ? o : 0) };
  }),
];

export default {
  id: "marble", title: "Marble Maze", icon: "marble", sensor: "tilt",
  desc: "Tilt the phone to roll the marble into the goal. Holes swallow it. Five levels.",
  modes: [{ id: "solo", label: "1 player", players: 1, scored: true }],
  phone: "Hold the phone flat like a tray and tilt it gently.",
  howto: ["Tilt the phone: the marble rolls downhill, like on a real board.",
          "Reach the green goal before the 45 s timer ends.",
          "Falling into a hole or running out of time costs a life (3 lives).",
          "Keyboard: W A S D tilt the board."],

  init() { return { level: 0, lives: 3, levelTime: 0, t: 0, fall: 0, ball: null, vx: 0, vy: 0, flash: 0, msg: "", msgT: 0 }; },

  update(g, s, dt) {
    const lv = LEVELS[s.level];
    s.t += dt;
    if (!s.ball) { s.ball = [...lv.start]; s.vx = s.vy = 0; s.levelTime = 0; }
    s.msgT -= dt; s.flash -= dt;
    const [bx, by] = s.ball;

    if (s.fall > 0) {                                         // falling into a hole: wait, then respawn
      s.fall -= dt;
      if (s.fall <= 0) {
        s.lives--;
        if (s.lives <= 0) return g.end({ title: "Game over", detail: `Reached level ${s.level + 1}` });
        s.ball = null;
      }
      return;
    }
    s.levelTime += dt;
    if (s.levelTime >= LEVEL_TIME) {                          // out of time
      s.lives--; g.sfx("bad"); g.buzz(1, [120, 60, 120]);
      if (s.lives <= 0) return g.end({ title: "Out of time", detail: `Reached level ${s.level + 1}` });
      s.ball = null; return;
    }

    const i = g.input(1);
    const clamp = (v, m) => Math.max(-m, Math.min(m, v));
    s.vx += clamp(i.tx, 30) * ACCEL * dt;
    s.vy += clamp(i.ty, 30) * ACCEL * dt;
    const damp = Math.exp(-FRICTION * dt);
    s.vx *= damp; s.vy *= damp;
    const sp = Math.hypot(s.vx, s.vy);
    if (sp > MAX_V) { s.vx *= MAX_V / sp; s.vy *= MAX_V / sp; }
    let x = bx + s.vx * dt, y = by + s.vy * dt;
    if (x < BALL_R) { x = BALL_R; s.vx = Math.abs(s.vx) * 0.4; }          // soft walls
    if (x > W - BALL_R) { x = W - BALL_R; s.vx = -Math.abs(s.vx) * 0.4; }
    if (y < BALL_R) { y = BALL_R; s.vy = Math.abs(s.vy) * 0.4; }
    if (y > H - BALL_R) { y = H - BALL_R; s.vy = -Math.abs(s.vy) * 0.4; }
    s.ball = [x, y];

    for (const h of holesOf(lv, s.t)) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < HOLE_R + 8) { s.vx += (h.x - x) / d * 260 * dt; s.vy += (h.y - y) / d * 260 * dt; }   // edge pulls the marble in
      if (d < FALL_AT) {
        s.fall = 0.55; s.vx = s.vy = 0; s.ball = [h.x, h.y]; g.sfx("bad"); g.buzz(1, [200]);
        return;
      }
    }
    if (Math.hypot(lv.goal[0] - x, lv.goal[1] - y) < GOAL_R - 6) {
      const bonus = Math.round((LEVEL_TIME - s.levelTime) * 3);
      g.addScore(1, 100 + bonus); g.sfx("win"); g.buzz(1, [60, 40, 60]);
      s.level++;
      if (s.level >= LEVELS.length) { g.addScore(1, 200); return g.end({ title: "You cleared every level", win: true, detail: "+200 bonus" }); }
      s.ball = null; s.msg = `Level ${s.level + 1}`; s.msgT = 1.4;
    }
  },

  draw(g, s) {
    const lv = LEVELS[Math.min(s.level, LEVELS.length - 1)];
    grid(48);
    // board edge
    ctx2(g).strokeStyle = C.border2; ctx2(g).lineWidth = 3; ctx2(g).strokeRect(2, 2, W - 4, H - 4);
    // goal
    const pulse = 1 + Math.sin(s.t * 4) * 0.06;
    circle(lv.goal[0], lv.goal[1], GOAL_R * pulse, "rgba(70,192,104,.16)", C.ok, 3);
    circle(lv.goal[0], lv.goal[1], 5, C.ok);
    // holes
    for (const h of holesOf(lv, s.t)) {
      circle(h.x, h.y, HOLE_R + 5, "#06080b", C.border2, 2);
      circle(h.x, h.y, HOLE_R - 6, "#000");
    }
    // start marker
    circle(lv.start[0], lv.start[1], 18, null, C.border2, 2);
    // marble
    if (s.ball) {
      const k = s.fall > 0 ? Math.max(0, s.fall / 0.55) : 1, [x, y] = s.ball, r = BALL_R * k;
      circle(x + 4, y + 5, r, "rgba(0,0,0,.45)");
      const grd = g.ctx.createRadialGradient(x - r * .35, y - r * .4, 2, x, y, r);
      grd.addColorStop(0, "#dfe6ff"); grd.addColorStop(.35, C.accent); grd.addColorStop(1, "#2a3fa0");
      circle(x, y, r, grd);
    }
    // HUD
    hud(1, "SCORE", g.score[1]);
    text(`Level ${Math.min(s.level + 1, LEVELS.length)} / ${LEVELS.length}`, W / 2, 34, { size: 14, color: C.text2, align: "center" });
    const left = Math.max(0, LEVEL_TIME - s.levelTime);
    text(`${left.toFixed(0)} s`, W / 2, 62, { size: 26, weight: 700, color: left < 10 ? C.bad : C.text, align: "center" });
    for (let i = 0; i < 3; i++) circle(W - 36 - i * 28, 40, 9, i < s.lives ? C.bad : null, i < s.lives ? null : C.border2);
    if (s.msgT > 0) text(s.msg, W / 2, H / 2, { size: 44, weight: 700, color: C.text, align: "center", base: "middle" });
    bubble(g, s);
  },
};
const ctx2 = g => g.ctx;

// small bubble level so the player sees how the phone is tilted
function bubble(g, s) {
  const i = g.input(1), cx = 60, cy = H - 60, r = 34, c = g.ctx;
  circle(cx, cy, r, "rgba(17,20,25,.8)", C.border2, 2);
  c.strokeStyle = C.border; c.lineWidth = 1;
  c.beginPath(); c.moveTo(cx - r, cy); c.lineTo(cx + r, cy); c.moveTo(cx, cy - r); c.lineTo(cx, cy + r); c.stroke();
  const k = r / 30;
  circle(cx + Math.max(-30, Math.min(30, i.tx)) * k * 0.85, cy + Math.max(-30, Math.min(30, i.ty)) * k * 0.85, 6, C.accent);
  text("TILT", cx, cy + r + 18, { size: 11, color: C.text3, align: "center" });
}
