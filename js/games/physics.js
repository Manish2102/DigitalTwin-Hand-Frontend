// physics.js - small 2D ball physics shared by Flick Carrom and Snooker Coach, plus the forward simulation
// ("what will happen if I play this shot") that both games draw as their AI preview.
//
// A table T: { w, h, wall (bounce), e (ball-ball restitution), decel (rolling friction), drag, stop (speed
// below which a ball stops), pr (pocket radius), pockets:[{x,y}] }. Balls: { id, kind, x, y, vx, vy, r, m, alive }.

export function step(balls, T, dt) {
  const sub = 4, h = dt / sub, ev = [];
  for (let s = 0; s < sub; s++) {
    for (const b of balls) {
      if (!b.alive) continue;
      b.x += b.vx * h; b.y += b.vy * h;
      if (b.x < b.r) { b.x = b.r; b.vx = -b.vx * T.wall; }
      if (b.x > T.w - b.r) { b.x = T.w - b.r; b.vx = -b.vx * T.wall; }
      if (b.y < b.r) { b.y = b.r; b.vy = -b.vy * T.wall; }
      if (b.y > T.h - b.r) { b.y = T.h - b.r; b.vy = -b.vy * T.wall; }
    }
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const c = balls[j];
        if (!c.alive) continue;
        const dx = c.x - a.x, dy = c.y - a.y, d2 = dx * dx + dy * dy, R = a.r + c.r;
        if (d2 >= R * R || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = R - d, ia = 1 / a.m, ic = 1 / c.m;
        a.x -= nx * ov * ia / (ia + ic); a.y -= ny * ov * ia / (ia + ic);          // push apart
        c.x += nx * ov * ic / (ia + ic); c.y += ny * ov * ic / (ia + ic);
        const vr = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
        if (vr > 0) continue;
        const J = -(1 + T.e) * vr / (ia + ic);                                     // impulse along the normal
        a.vx -= J * ia * nx; a.vy -= J * ia * ny; c.vx += J * ic * nx; c.vy += J * ic * ny;
        if (a.hit == null) a.hit = c.id;
        if (c.hit == null) c.hit = a.id;
      }
    }
    for (const b of balls) {
      if (!b.alive) continue;
      for (const p of T.pockets) {
        if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < T.pr * T.pr) { b.alive = false; b.vx = b.vy = 0; ev.push({ ball: b, pocket: p }); break; }
      }
    }
  }
  for (const b of balls) {
    if (!b.alive) continue;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp < T.stop) { b.vx = b.vy = 0; continue; }
    const ns = Math.max(0, sp - T.decel * dt) * Math.pow(T.drag, dt);
    b.vx *= ns / sp; b.vy *= ns / sp;
  }
  return ev;
}

export const moving = balls => balls.some(b => b.alive && (b.vx || b.vy));

// Play the shot on a copy of the table and record every ball's path, what goes in, and what the cue ball hits first.
export function predict(balls, T, cueId, vx, vy, secs) {
  const bs = balls.map(b => ({ ...b, hit: null })), cue = bs.find(b => b.id === cueId);
  cue.vx = vx; cue.vy = vy;
  const paths = {}, pots = [], dt = 1 / 90;
  bs.forEach(b => paths[b.id] = [{ x: b.x, y: b.y }]);
  for (let k = 0; k < secs * 90; k++) {
    for (const e of step(bs, T, dt)) pots.push({ id: e.ball.id, kind: e.ball.kind, pocket: e.pocket });
    if (k % 3 === 0) bs.forEach(b => { if (b.alive && (b.vx || b.vy)) paths[b.id].push({ x: b.x, y: b.y }); });
    if (!moving(bs)) break;
  }
  bs.forEach(b => {
    if (b.alive) { if (b.vx || b.vy || paths[b.id].length > 1) paths[b.id].push({ x: b.x, y: b.y }); }
    else { const pe = pots.find(p => p.id === b.id); if (pe) paths[b.id].push({ x: pe.pocket.x, y: pe.pocket.y }); }
  });
  return { paths, pots, firstHit: cue.hit, final: bs };
}
