// Tilt Pong - tilt your phone left and right to slide your paddle. Two players (two phones), or you against the computer.
// Physical sensor: orientation (tilt). The paddle position follows the tilt angle directly, like a steering board.

import { W, H, C, text, hud, roundRect, circle, P_COLOR, bestScore } from "./engine.js";

const PW = 150, PH = 16, BR = 11, WIN_AT = 7, TILT_RANGE = 22;   // +/- 22 degrees sweeps the whole width
const MARGIN = 34;

function serve(s, dir) {
  s.bx = W / 2; s.by = H / 2; s.hold = 0.9;
  const a = (Math.random() * 0.6 - 0.3);
  s.speed = 420;
  s.vx = Math.sin(a) * s.speed; s.vy = Math.cos(a) * s.speed * dir;
}

export default {
  id: "pong", title: "Tilt Pong", icon: "disc", sensor: "tilt",
  desc: "Slide your paddle by tilting the phone. First to seven wins. Two players, or you against the computer.",
  modes: [{ id: "cpu", label: "vs computer", players: 1, scored: true }, { id: "duo", label: "2 players", players: 2, scored: false }],
  phone: "Hold the phone flat like a tray. Tilt left and right to move your paddle.",
  howto: ["Tilt the phone right to slide your paddle right, left to slide it left.",
          "Keep the ball from passing your edge. Hits near the paddle's end send it sideways.",
          "The ball speeds up with every hit. First to 7 points wins.",
          "Keyboard: A and D for player 1, left and right arrows for player 2."],

  init(g, mode) {
    const s = { duo: mode.id === "duo", pos: [0, W / 2, W / 2], pts: [0, 0, 0], bx: 0, by: 0, vx: 0, vy: 0, speed: 420, hold: 0, trail: [], hits: 0 };
    serve(s, 1);
    return s;
  },

  update(g, s, dt) {
    // paddles: P1 at the bottom, P2 (or the computer) at the top
    for (const p of [1, 2]) {
      if (p === 2 && !s.duo) {                                    // computer: chases the ball at a limited speed, so it can be beaten
        const want = s.vy < 0 ? s.bx : W / 2, maxMove = (300 + s.pts[1] * 40) * dt;
        s.pos[2] += Math.max(-maxMove, Math.min(maxMove, want - s.pos[2]));
      } else {
        const target = W / 2 + Math.max(-1, Math.min(1, g.input(p).tx / TILT_RANGE)) * (W / 2 - PW / 2);
        s.pos[p] += (target - s.pos[p]) * Math.min(1, dt * 18);
      }
      s.pos[p] = Math.max(PW / 2, Math.min(W - PW / 2, s.pos[p]));
    }
    if (s.hold > 0) { s.hold -= dt; return; }

    s.bx += s.vx * dt; s.by += s.vy * dt;
    s.trail.push([s.bx, s.by]); if (s.trail.length > 12) s.trail.shift();
    if (s.bx < BR) { s.bx = BR; s.vx = Math.abs(s.vx); g.sfx("bounce"); }
    if (s.bx > W - BR) { s.bx = W - BR; s.vx = -Math.abs(s.vx); g.sfx("bounce"); }

    for (const p of [1, 2]) {
      const py = p === 1 ? H - MARGIN : MARGIN;
      const down = p === 1;                                       // player 1's paddle catches a ball moving down
      if ((down ? s.vy > 0 : s.vy < 0) && Math.abs(s.by - py) < PH / 2 + BR && Math.abs(s.bx - s.pos[p]) < PW / 2 + BR) {
        const off = (s.bx - s.pos[p]) / (PW / 2);                 // -1..1 where it hit the paddle
        s.speed = Math.min(900, s.speed * 1.05);
        s.vx = off * s.speed * 0.75;
        s.vy = (down ? -1 : 1) * Math.sqrt(Math.max(1, s.speed * s.speed - s.vx * s.vx));
        s.by = py + (down ? -1 : 1) * (PH / 2 + BR);
        g.sfx("bounce"); g.buzz(p, [20]); s.hits++;
      }
    }
    if (s.by > H + BR || s.by < -BR) {                            // somebody missed
      const scorer = s.by < 0 ? 1 : 2;
      s.pts[scorer]++;
      if (scorer === 1 || s.duo) g.addScore(scorer, 100);
      g.sfx(scorer === 1 ? "good" : "bad"); g.buzz(scorer === 1 ? 2 : 1, [160]);
      if (s.pts[scorer] >= WIN_AT) {
        if (scorer === 1 || s.duo) g.addScore(scorer, 200);
        return g.end({ title: s.duo ? `Player ${scorer} wins` : scorer === 1 ? "You win" : "Computer wins", win: s.duo ? true : scorer === 1, winner: scorer,
                       detail: `${s.pts[1]} - ${s.pts[2]}` });
      }
      serve(s, scorer === 1 ? -1 : 1);                            // the player who lost the point receives the next serve
      s.trail = [];
    }
  },

  draw(g, s) {
    const c = g.ctx;
    c.setLineDash([10, 12]); c.strokeStyle = C.border2; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.stroke(); c.setLineDash([]);
    text(String(s.pts[2]), 40, H / 2 - 24, { size: 56, weight: 700, color: P_COLOR[2] });
    text(String(s.pts[1]), 40, H / 2 + 74, { size: 56, weight: 700, color: P_COLOR[1] });
    text(s.duo ? "PLAYER 2" : "COMPUTER", W - 24, H / 2 - 18, { size: 12, color: P_COLOR[2], align: "right" });
    text(s.duo ? "PLAYER 1" : "YOU", W - 24, H / 2 + 30, { size: 12, color: P_COLOR[1], align: "right" });
    for (const [x, y] of s.trail) { c.globalAlpha = 0.12; circle(x, y, BR, C.text); } c.globalAlpha = 1;
    circle(s.bx, s.by, BR, C.text);
    roundRect(s.pos[1] - PW / 2, H - MARGIN - PH / 2, PW, PH, 8, P_COLOR[1]);
    roundRect(s.pos[2] - PW / 2, MARGIN - PH / 2, PW, PH, 8, P_COLOR[2]);
    if (!s.duo) text(`Best ${bestScore("pong", "cpu")}`, W - 24, 30, { size: 12, color: C.text3, align: "right" });
    if (s.hold > 0) text("Get ready", W / 2, H / 2 + 6, { size: 26, color: C.text2, align: "center", base: "middle" });
  },
};
