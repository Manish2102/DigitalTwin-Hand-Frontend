// swipe.js - turns hand landmarks into deliberate left / right swipes, and ignores everything else.
//
// Deliberately simple, so a real hand (not a perfect one) triggers it. A swipe is reported when, within the last
// windowMs, the hand's palm centre travelled sideways by at least `dist` frame widths, and:
//   - mostly sideways (not diagonal or up/down), and nearly every step went the same way (not a wobble or wave);
//   - no single tracking jump made up most of it (a glitch or a hand swap);
//   - the hand was in view for a moment before (a hand entering the frame does not count) and it is not a fist;
//   - not during the cooldown, and not back the other way soon after (the hand returning after a swipe).
// Size of the hand does not matter (the distance is a fraction of the picture). "right" = the hand moves to the
// presenter's right; x is mirrored here because the camera image is not.

const PRESETS = {
  strict: { dist: 0.30, windowMs: 650, minMs: 120, mono: 0.75, cooldown: 1100, back: 1600 },
  normal: { dist: 0.20, windowMs: 750, minMs: 100, mono: 0.65, cooldown: 900,  back: 1400 },
  easy:   { dist: 0.14, windowMs: 900, minMs: 90,  mono: 0.60, cooldown: 800,  back: 1200 },
};
const KEEP_MS = 1500, SEEN_MS = 100;

const dist = (a, b, asp) => Math.hypot((a[0] - b[0]) * asp, a[1] - b[1]);

// one hand's summary: palm centre (mirrored so x grows to the presenter's right), palm length, fingers straight
export function handInfo(lm, aspect = 4 / 3) {
  const ids = [0, 5, 9, 13, 17];
  let x = 0, y = 0;
  for (const i of ids) { x += lm[i][0]; y += lm[i][1]; }
  x /= ids.length; y /= ids.length;
  const palm = dist(lm[0], lm[9], aspect) || 0.05;
  let straight = 0;
  for (const [tip, pip] of [[8, 6], [12, 10], [16, 14], [20, 18]]) {
    if (dist(lm[tip], lm[0], aspect) > dist(lm[pip], lm[0], aspect) * 1.12) straight++;
  }
  return { x: 1 - x, y, palm, open: straight >= 2 };
}

export class SwipeDetector {
  constructor({ sensitivity = "normal", requireOpen = true } = {}) {
    this.setSensitivity(sensitivity);
    this.requireOpen = requireOpen;
    this.reset();
  }
  setSensitivity(name) { this.cfg = PRESETS[name] ?? PRESETS.normal; this.sensitivity = PRESETS[name] ? name : "normal"; }
  reset() { this.buf = []; this.coolUntil = 0; this.backDir = 0; this.backUntil = 0; this.progress = 0; this.lastSeen = -1e9; this.dx = 0; }

  // feed one tracking result; returns "left", "right" or null. t in ms.
  update(t, hands, aspect = 4 / 3) {
    const c = this.cfg;
    this.progress = 0; this.dx = 0;
    if (!hands || !hands.length) {                     // no hand: a short blur drop-out is fine, a long one starts fresh
      if (t - this.lastSeen > 300) this.buf = [];
      return null;
    }
    let best = null;                                   // the presenter's hand = the biggest one in view
    for (const lm of hands) { const h = handInfo(lm, aspect); if (!best || h.palm > best.palm) best = h; }
    if (this.buf.length && t - this.lastSeen > 300) this.buf = [];
    this.lastSeen = t;
    this.buf.push({ t, ...best });
    while (this.buf.length && t - this.buf[0].t > KEEP_MS) this.buf.shift();
    if (t < this.coolUntil) return null;

    const b = this.buf, now = b[b.length - 1];
    for (let k = b.length - 2; k >= 0; k--) {
      const s = b[k], dt = t - s.t;
      if (dt < c.minMs) continue;
      if (dt > c.windowMs) break;
      const dx = now.x - s.x, dyW = (now.y - s.y) / aspect;           // both in frame widths
      this.progress = Math.max(this.progress, Math.min(1, Math.abs(dx) / c.dist));
      if (Math.abs(dx) > Math.abs(this.dx)) this.dx = dx;
      if (Math.abs(dx) < c.dist || Math.abs(dx) < 1.3 * Math.abs(dyW)) continue;
      const seg = b.slice(k), dir = Math.sign(dx);
      if (seg.length < 3) continue;
      let same = 0, steps = 0, jump = 0, mvOpen = 0;
      for (let j = 1; j < seg.length; j++) {
        const st = seg[j].x - seg[j - 1].x;
        if (Math.abs(st) > 0.004) { steps++; if (Math.sign(st) === dir) same++; if (seg[j].open) mvOpen++; }
        jump = Math.max(jump, Math.abs(st));
      }
      if (jump > 0.75 * Math.abs(dx)) continue;                       // one-frame jump = tracking glitch
      if (steps < 2 || same < c.mono * steps) continue;
      if (this.requireOpen && (mvOpen < 0.6 * steps || !(now.open || b[b.length - 2].open))) continue;   // not a fist
      if (s.t - b[0].t < SEEN_MS) continue;                           // the hand was not in view before the movement
      const before = b.filter(p => p.t <= s.t && p.t >= s.t - 300);
      const xs = before.map(p => p.x);
      if (Math.max(...xs) - Math.min(...xs) > 0.35 * Math.abs(dx)) continue;   // it was already moving (entering, or a wave): not a fresh swipe
      if (this.backDir === -dir && t < this.backUntil) { this.buf = []; this.coolUntil = t + 300; return null; }   // returning hand
      this.coolUntil = t + c.cooldown; this.backDir = dir; this.backUntil = t + c.back;
      this.buf = []; this.progress = 1;
      return dir > 0 ? "right" : "left";
    }
    return null;
  }
}

export const SENSITIVITIES = Object.keys(PRESETS);
