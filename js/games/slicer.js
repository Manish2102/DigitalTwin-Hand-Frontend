// Fruit Slicer - swipe your index finger (or the mouse) through the fruit. Do not touch the bombs.
// Physical sensor: the hand camera. The twin watches the fingertip path; a swipe that crosses a fruit slices it.

import { W, H, C, text, hud, circle, bestScore } from "./engine.js";

const FRUIT = [["#f2665e", "#ffb1ac"], ["#e0a83a", "#ffe19a"], ["#46c068", "#a5f0b8"], ["#c47dff", "#e8cbff"], ["#4fc3f7", "#bdeaff"]];
const GRAV = 900, R = 36, TRAIL_MS = 260;

// map the camera view to the playfield with a margin, so the player can reach the edges
const mapX = v => Math.max(0, Math.min(1, (v - 0.08) / 0.84)) * W;
const mapY = v => Math.max(0, Math.min(1, (v - 0.08) / 0.84)) * H;

function segDist(px, py, ax, ay, bx, by) {            // distance from a point to a line segment
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function spawn(s) {
  const bomb = Math.random() < Math.min(0.22, 0.08 + s.t * 0.002);
  const x = 140 + Math.random() * (W - 280);
  const towards = (W / 2 - x) * 0.25;
  s.items.push({
    x, y: H + R, vx: towards + (Math.random() - 0.5) * 120, vy: -(800 + Math.random() * 170),
    bomb, col: FRUIT[Math.floor(Math.random() * FRUIT.length)], rot: Math.random() * 6, spin: (Math.random() - 0.5) * 6, dead: false, seen: false,
  });
}

export default {
  id: "slicer", title: "Fruit Slicer", icon: "scissors", sensor: "hand",
  desc: "Swipe your finger through flying fruit. Slice several at once for a combo. Avoid the bombs.",
  modes: [{ id: "solo", label: "1 player", players: 1, scored: true }],
  phone: "Start the camera and hold one hand in view. Point with your index finger.",
  howto: ["Move your index finger fast across the screen to slice fruit.",
          "Slicing two or more with one swipe gives bonus points.",
          "Missing a fruit or slicing a bomb costs a life (3 lives).",
          "Mouse: move the pointer quickly over the fruit."],

  init() { return { t: 0, items: [], halves: [], drops: [], trail: [], lives: 3, next: 0.6, lastSeq: -1, swipe: [], flash: 0, shownHand: false }; },

  update(g, s, dt) {
    s.t += dt; s.flash -= dt;
    const i = g.input(1), now = performance.now();

    // fingertip path -> trail, and slicing along each new segment
    if (i.hand && i.tipSeq !== s.lastSeq) {
      s.lastSeq = i.tipSeq;
      const p = { x: mapX(i.tip[0]), y: mapY(i.tip[1]), t: now };
      const prev = s.trail[s.trail.length - 1];
      s.trail.push(p);
      if (prev && now - prev.t < 150) {
        const len = Math.hypot(p.x - prev.x, p.y - prev.y);
        if (len > 14) {                                   // slow drifting does not cut
          const hit = [];
          for (const it of s.items) if (!it.dead && segDist(it.x, it.y, prev.x, prev.y, p.x, p.y) < R + 6) hit.push(it);
          for (const it of hit) cut(g, s, it, p.x - prev.x, p.y - prev.y);
          const fruitHit = hit.filter(it => !it.bomb).length;
          if (fruitHit >= 2) { const b = (fruitHit - 1) * 5; g.addScore(1, b); s.drops.push({ x: p.x, y: p.y - 30, vy: -40, life: 1, txt: `Combo +${b}`, col: C.warn }); }
        }
      }
    }
    while (s.trail.length && now - s.trail[0].t > TRAIL_MS) s.trail.shift();

    // spawning gets faster with time
    s.next -= dt;
    if (s.next <= 0) {
      const n = 1 + (Math.random() < Math.min(0.5, s.t / 90) ? 1 : 0) + (Math.random() < Math.min(0.25, s.t / 150) ? 1 : 0);
      for (let k = 0; k < n; k++) spawn(s);
      s.next = Math.max(0.55, 1.5 - s.t * 0.012) + Math.random() * 0.4;
    }

    for (const it of s.items) {
      it.vy += GRAV * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.spin * dt;
      if (it.y < H) it.seen = true;
      if (it.y > H + R * 2 && it.vy > 0 && it.seen && !it.dead) {                 // fell out unsliced
        it.dead = true;
        if (!it.bomb) { s.lives--; g.sfx("bad"); g.buzz(1, [80]); s.flash = 0.25; if (s.lives <= 0) return g.end({ title: "Game over" }); }
      }
    }
    s.items = s.items.filter(it => !it.dead);
    for (const h of s.halves) { h.vy += GRAV * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.spin * dt; h.life -= dt; }
    s.halves = s.halves.filter(h => h.life > 0 && h.y < H + 100);
    for (const d of s.drops) { d.y += d.vy * dt; d.life -= dt * 1.2; }
    s.drops = s.drops.filter(d => d.life > 0);
  },

  draw(g, s) {
    const c = g.ctx;
    if (s.flash > 0) { c.fillStyle = `rgba(242,102,94,${s.flash * 0.6})`; c.fillRect(0, 0, W, H); }
    for (const h of s.halves) {
      c.save(); c.translate(h.x, h.y); c.rotate(h.rot); c.globalAlpha = Math.min(1, h.life * 2);
      c.beginPath(); c.arc(0, 0, R, h.flip ? Math.PI : 0, h.flip ? Math.PI * 2 : Math.PI); c.closePath();
      c.fillStyle = h.col[0]; c.fill();
      c.beginPath(); c.arc(0, 0, R - 8, h.flip ? Math.PI : 0, h.flip ? Math.PI * 2 : Math.PI); c.closePath();
      c.fillStyle = h.col[1]; c.fill();
      c.restore();
    }
    for (const it of s.items) {
      if (it.dead) continue;
      c.save(); c.translate(it.x, it.y); c.rotate(it.rot);
      if (it.bomb) {
        circle(0, 0, R - 2, "#171b22", C.bad, 3);
        c.strokeStyle = C.bad; c.lineWidth = 4; c.lineCap = "round";
        c.beginPath(); c.moveTo(-10, -10); c.lineTo(10, 10); c.moveTo(10, -10); c.lineTo(-10, 10); c.stroke();
      } else {
        circle(0, 0, R, it.col[0]);
        circle(-R * 0.32, -R * 0.34, R * 0.3, "rgba(255,255,255,.28)");
        c.strokeStyle = "#2c6b3d"; c.lineWidth = 4; c.lineCap = "round";
        c.beginPath(); c.moveTo(0, -R + 2); c.quadraticCurveTo(6, -R - 10, 14, -R - 8); c.stroke();
      }
      c.restore();
    }
    // slice trail
    if (s.trail.length > 1) {
      const now = performance.now();
      c.lineCap = "round"; c.lineJoin = "round";
      for (let k = 1; k < s.trail.length; k++) {
        const a = s.trail[k - 1], b = s.trail[k], age = 1 - (now - b.t) / TRAIL_MS;
        c.strokeStyle = `rgba(231,233,236,${Math.max(0, age)})`; c.lineWidth = 2 + 9 * Math.max(0, age);
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      }
    }
    const i = g.input(1);
    if (i.hand) { const p = s.trail[s.trail.length - 1]; if (p) circle(p.x, p.y, 8, null, C.accent, 3); }
    for (const d of s.drops) text(d.txt, d.x, d.y, { size: 22, color: d.col, align: "center" });
    hud(1, "SCORE", g.score[1]);
    for (let k = 0; k < 3; k++) circle(W - 36 - k * 28, 40, 9, k < s.lives ? C.bad : null, k < s.lives ? null : C.border2);
    text(`Best ${bestScore("slicer", "solo")}`, W - 24, 76, { size: 12, color: C.text3, align: "right" });
    if (!i.hand && g.time > 1) text("Show your hand to the phone camera", W / 2, H - 28, { size: 16, color: C.text2, align: "center" });
  },
};

function cut(g, s, it, dx, dy) {
  it.dead = true;
  const ang = Math.atan2(dy, dx);
  if (it.bomb) {
    s.lives--; s.flash = 0.45; g.sfx("bad"); g.buzz(1, [250]);
    if (s.lives <= 0) g.end({ title: "Boom", win: false });
    return;
  }
  g.addScore(1, 10); g.sfx("good"); g.buzz(1, [25]);
  for (const flip of [false, true]) {
    const side = flip ? 1 : -1;
    s.halves.push({ x: it.x, y: it.y, vx: it.vx + Math.cos(ang + Math.PI / 2) * 140 * side, vy: it.vy * 0.4 + Math.sin(ang + Math.PI / 2) * 140 * side,
                    rot: ang, spin: side * 3, life: 1.4, flip, col: it.col });
  }
  s.drops.push({ x: it.x, y: it.y - 20, vy: -50, life: 0.7, txt: "+10", col: C.ok });
}
