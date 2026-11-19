// Shake Duel - shake the phone as hard as you can for 10 seconds. Alone (beat your best) or head to head.
// Physical sensor: the accelerometer. The phone reports the strongest acceleration in each 50 ms slice;
// the twin turns that into power: anything above a gentle wobble counts, harder shaking counts more.

import { W, H, C, text, roundRect, P_COLOR, bestScore } from "./engine.js";

const DURATION = 10, FLOOR = 2.5, SCALE = 0.1;       // m/s² below FLOOR is just holding the phone

export default {
  id: "shake", title: "Shake Duel", icon: "vibrate", sensor: "shake",
  desc: "Shake the phone as hard as you can for 10 seconds. Beat your best, or beat a friend.",
  modes: [{ id: "solo", label: "1 player", players: 1, scored: true }, { id: "duo", label: "2 players", players: 2, scored: false }],
  phone: "Share motion sensors, then hold the phone firmly - you will be shaking it hard.",
  howto: ["After 3, 2, 1 shake the phone for 10 seconds.",
          "Harder shaking scores more; a gentle wobble does not count.",
          "Hold on tight and keep a firm grip on the phone.",
          "Keyboard: tap Space (player 1) or Enter (player 2) as fast as you can."],

  init(g, mode) { return { duo: mode.id === "duo", seen: [0, 0, 0], level: [0, 0, 0], sparks: [], t: 0 }; },

  update(g, s, dt) {
    s.t += dt;
    for (const p of s.duo ? [1, 2] : [1]) {
      const i = g.input(p);
      let hit = 0;
      if (i.shakeSeq !== s.seen[p]) {                    // a new sensor message arrived
        s.seen[p] = i.shakeSeq;
        hit = Math.max(0, i.shake - FLOOR);
        if (hit) g.addScore(p, hit * SCALE);
      }
      s.level[p] += (Math.min(1, hit / 25) - s.level[p]) * Math.min(1, dt * 8);
      if (hit > 8 && Math.random() < 0.6) s.sparks.push({ p, x: 0, y: 0, vx: (Math.random() - 0.5) * 240, vy: -120 - Math.random() * 200, life: 0.6 });
    }
    for (const sp of s.sparks) { sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 500 * dt; sp.life -= dt; }
    s.sparks = s.sparks.filter(sp => sp.life > 0);
    if (s.t >= DURATION) {
      const a = Math.round(g.score[1]), b = Math.round(g.score[2]);
      g.setScore(1, a); g.setScore(2, b);
      if (!s.duo) return g.end({ title: "Time", win: true, detail: `${a} power` });
      const winner = a === b ? 0 : a > b ? 1 : 2;
      g.end({ title: winner ? `Player ${winner} wins` : "Draw", win: true, winner, detail: `${a} vs ${b}` });
    }
  },

  draw(g, s) {
    const c = g.ctx, ps = s.duo ? [1, 2] : [1];
    const left = Math.max(0, DURATION - s.t);
    text(left.toFixed(1), W / 2, 90, { size: 64, weight: 700, color: left < 3 ? C.warn : C.text, align: "center" });
    text("SECONDS", W / 2, 118, { size: 12, color: C.text3, align: "center" });
    const cap = Math.max(300, bestScore("shake", "solo"), g.score[1], g.score[2]);
    ps.forEach((p, k) => {
      const cx = s.duo ? (k === 0 ? W * 0.27 : W * 0.73) : W / 2, bw = 150, bh = 330, bx = cx - bw / 2, by = 170;
      text(s.duo ? `Player ${p}` : "Power", cx, 160, { size: 18, color: P_COLOR[p], align: "center" });
      roundRect(bx, by, bw, bh, 12, C.surface, C.border2);
      const fill = Math.min(1, g.score[p] / cap) * (bh - 8);
      const jitter = (Math.random() - 0.5) * 6 * s.level[p];
      roundRect(bx + 4 + jitter, by + bh - 4 - fill, bw - 8, fill, 8, P_COLOR[p]);
      text(String(Math.round(g.score[p])), cx, by + bh + 52, { size: 40, weight: 700, align: "center" });
      // live intensity gauge
      c.fillStyle = C.s3; c.fillRect(cx - 60, by + bh + 66, 120, 6);
      c.fillStyle = C.ok; c.fillRect(cx - 60, by + bh + 66, 120 * s.level[p], 6);
      for (const sp of s.sparks) if (sp.p === p) { c.fillStyle = P_COLOR[p]; c.globalAlpha = sp.life; c.fillRect(cx + sp.x - 2, by + sp.y + 40 - 2, 4, 4); c.globalAlpha = 1; }
    });
    if (!s.duo) text(`Best ${bestScore("shake", "solo")}`, W - 24, 30, { size: 12, color: C.text3, align: "right" });
  },
};
