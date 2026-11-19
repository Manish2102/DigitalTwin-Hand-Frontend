// Sky Glider - the height of your hand steers a paper glider through gaps in scrolling pillars.
// Physical sensor: the hand camera. Raise your hand to climb, lower it to dive.

import { W, H, C, text, hud, circle, bestScore } from "./engine.js";

const GX = 230, GR = 15, PILLAR_W = 78, SPACING = 330;
const mapY = v => Math.max(0, Math.min(1, (v - 0.2) / 0.6));        // usable part of the camera view

function addPillar(s, x) {
  const gap = Math.max(150, 215 - s.passed * 3);
  const lo = gap / 2 + 50, hi = H - gap / 2 - 50;
  let cy = lo + Math.random() * (hi - lo);
  if (s.lastGap != null) cy = Math.max(s.lastGap - 230, Math.min(s.lastGap + 230, cy));   // never an impossible jump
  cy = Math.max(lo, Math.min(hi, cy)); s.lastGap = cy;
  s.pillars.push({ x, cy, gap, scored: false });
}

export default {
  id: "glider", title: "Sky Glider", icon: "wind", sensor: "hand",
  desc: "Raise and lower your hand to fly a glider through the gaps. How far can you get?",
  modes: [{ id: "solo", label: "1 player", players: 1, scored: true }],
  phone: "Start the camera and hold one hand in view. Move it up and down.",
  howto: ["Hand up: the glider climbs. Hand down: it dives.",
          "Fly through the gaps in the pillars, one point each.",
          "The world speeds up and the gaps shrink as you go.",
          "Keyboard: W and S, or move the mouse up and down."],

  init() {
    const s = { y: H / 2, vy: 0, pillars: [], passed: 0, dist: 0, lastGap: null, trail: [] };
    for (let k = 0; k < 4; k++) addPillar(s, 620 + k * SPACING);
    return s;
  },

  update(g, s, dt) {
    const speed = 250 + Math.min(200, s.passed * 7);
    const i = g.input(1);
    const target = 30 + mapY(i.hy) * (H - 60);                      // hand lost: the last height is held
    const ny = s.y + (target - s.y) * Math.min(1, dt * 9);
    s.vy = (ny - s.y) / dt; s.y = ny;
    s.trail.push({ x: GX, y: s.y }); if (s.trail.length > 22) s.trail.shift();
    for (const t of s.trail) t.x -= speed * dt;
    for (const p of s.pillars) p.x -= speed * dt;
    while (s.pillars[0] && s.pillars[0].x + PILLAR_W < -10) s.pillars.shift();
    const lastX = s.pillars[s.pillars.length - 1].x;
    if (lastX < W + 100) addPillar(s, lastX + SPACING);
    for (const p of s.pillars) {
      if (!p.scored && p.x + PILLAR_W < GX - GR) { p.scored = true; s.passed++; g.addScore(1, 1); g.sfx("good"); g.buzz(1, [15]); }
      if (GX + GR > p.x && GX - GR < p.x + PILLAR_W) {
        if (s.y - GR < p.cy - p.gap / 2 || s.y + GR > p.cy + p.gap / 2) { g.buzz(1, [250]); return g.end({ title: "Crashed", detail: `${s.passed} gaps` }); }
      }
    }
  },

  draw(g, s) {
    const c = g.ctx;
    // soft horizon lines
    c.strokeStyle = C.border; c.lineWidth = 1;
    for (let y = 100; y < H; y += 100) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    for (const p of s.pillars) {
      for (const [y0, y1] of [[0, p.cy - p.gap / 2], [p.cy + p.gap / 2, H]]) {
        c.fillStyle = C.s3; c.fillRect(p.x, y0, PILLAR_W, y1 - y0);
        c.strokeStyle = C.border2; c.lineWidth = 2; c.strokeRect(p.x, y0, PILLAR_W, y1 - y0);
      }
      c.fillStyle = C.accent; c.fillRect(p.x - 4, p.cy - p.gap / 2 - 6, PILLAR_W + 8, 6); c.fillRect(p.x - 4, p.cy + p.gap / 2, PILLAR_W + 8, 6);
    }
    // vapour trail
    for (let k = 1; k < s.trail.length; k++) {
      c.strokeStyle = `rgba(123,150,255,${k / s.trail.length * 0.5})`; c.lineWidth = 1 + k / 4;
      c.beginPath(); c.moveTo(s.trail[k - 1].x, s.trail[k - 1].y); c.lineTo(s.trail[k].x, s.trail[k].y); c.stroke();
    }
    // glider (a paper plane that pitches with vertical speed)
    c.save(); c.translate(GX, s.y); c.rotate(Math.max(-0.6, Math.min(0.6, s.vy / 900)));
    c.beginPath(); c.moveTo(22, 0); c.lineTo(-16, -13); c.lineTo(-8, 0); c.lineTo(-16, 13); c.closePath();
    c.fillStyle = C.text; c.fill(); c.strokeStyle = C.accent; c.lineWidth = 2; c.stroke();
    c.restore();
    hud(1, "GAPS", g.score[1]);
    text(`Best ${bestScore("glider", "solo")}`, W - 24, 30, { size: 12, color: C.text3, align: "right" });
    if (!g.input(1).hand && g.time > 1) text("Show your hand to the phone or laptop camera", W / 2, H - 28, { size: 16, color: C.text2, align: "center" });
  },
};
