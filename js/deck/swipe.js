// swipe.js - turns hand landmarks into deliberate left / right swipes, and ignores everything else.
//
// A swipe is reported only when ALL of these hold (presets below):
//   1. one hand, open (at least 3 of the 4 fingers straight), for most of the movement
//   2. the hand was already in view and fairly still before the movement started (a hand entering the
//      frame, or the end of another movement, does not count)
//   3. it travelled far enough sideways, measured in palm lengths, so it works near or far from the camera
//   4. quickly (within maxMs) and straight: mostly horizontal, and nearly every step in the same direction
//   5. not during the cooldown after the last swipe, and not back the other way soon after (the hand coming back)
// Directions are as the presenter sees them: "right" = the hand moves to the presenter's right.

const PRESETS = {
  strict: { vmin: 1.8, maxFrac: 0.40, palms: 2.4, minFrac: 0.15, maxMs: 700, straight: 0.6, mono: 0.75, cooldown: 1100, back: 1600, settle: 200 },
  normal: { vmin: 1.4, maxFrac: 0.30, palms: 1.9, minFrac: 0.11, maxMs: 850, straight: 0.8, mono: 0.7,  cooldown: 900,  back: 1400, settle: 120 },
  easy:   { vmin: 1.1, maxFrac: 0.22, palms: 1.4, minFrac: 0.08, maxMs: 1000, straight: 1.0, mono: 0.65, cooldown: 800,  back: 1200, settle: 80 },
};
const MAX_PALM = 0.2;            // palm length (frame heights) used for the distance rules, at most
const MIN_MS = 90;               // faster than this is tracking noise, not a hand movement
const KEEP_MS = 1500;

const dist = (a, b, asp) => Math.hypot((a[0] - b[0]) * asp, a[1] - b[1]);

// one hand's summary: palm centre (mirrored so x grows to the presenter's right), palm length, openness
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
  reset() { this.buf = []; this.coolUntil = 0; this.backDir = 0; this.backUntil = 0; this.progress = 0; this.lastSeen = -1e9; }

  // feed one tracking result; returns "left", "right" or null. t in ms.
  update(t, hands, aspect = 4 / 3) {
    const c = this.cfg;
    this.progress = 0;
    if (!hands || !hands.length) {                     // no hand: forget the path, so a hand coming back starts fresh
      if (t - this.lastSeen > 250) this.buf = [];
      return null;
    }
    // the presenter's hand = the biggest one in view (closest to the camera)
    let best = null;
    for (const lm of hands) { const h = handInfo(lm, aspect); if (!best || h.palm > best.palm) best = h; }
    if (this.buf.length && t - this.lastSeen > 250) this.buf = [];
    this.lastSeen = t;
    this.buf.push({ t, ...best });
    while (this.buf.length && t - this.buf[0].t > KEEP_MS) this.buf.shift();
    if (t < this.coolUntil) return null;

    const now = this.buf[this.buf.length - 1];
    let fired = null;
    for (let k = this.buf.length - 2; k >= 0; k--) {
      const s = this.buf[k], dt = t - s.t;
      if (dt < MIN_MS) continue;
      if (dt > c.maxMs) break;
      const dx = (now.x - s.x) * aspect, dy = now.y - s.y;            // both in units of frame height
      const palm = Math.min((s.palm + now.palm) / 2, MAX_PALM);     // a hand right at the camera is huge: cap it, or the swipe would have to cross the whole picture
      const need = Math.min(Math.max(c.palms * palm, c.minFrac * aspect), c.maxFrac * aspect);
      this.progress = Math.max(this.progress, Math.min(1, Math.abs(dx) / need));
      if (Math.abs(dx) < need || Math.abs(dy) > c.straight * Math.abs(dx)) continue;
      const seg = this.buf.slice(k), dir = Math.sign(dx);
      if (seg.length < 3) continue;                                   // a real movement spans several frames
      let same = 0, open = 0, jump = 0;
      for (let j = 1; j < seg.length; j++) {
        const step = (seg[j].x - seg[j - 1].x) * aspect;
        if (Math.sign(step) === dir || step === 0) same++;
        jump = Math.max(jump, Math.abs(step), Math.abs(seg[j].y - seg[j - 1].y));
      }
      if (jump > 0.7 * Math.abs(dx)) continue;                        // one-frame jump = tracking glitch (e.g. a hand swap)
      for (const p of seg) if (p.open) open++;
      if (same < c.mono * (seg.length - 1)) continue;
      const mv = seg.filter((p, j) => j > 0 && Math.abs(p.x - seg[j - 1].x) * aspect > 0.5 * Math.abs(dx) / (seg.length - 1));   // frames where the hand really moves
      if (this.requireOpen && mv.length && mv.filter(p => p.open).length < 0.6 * mv.length) continue;   // ... must be open
      if (this.requireOpen && open < 0.4 * seg.length) continue;
      // the hand must have been in view, and fairly still, just before the movement began
      const before = this.buf.filter(p => p.t < s.t && p.t >= s.t - 450);
      if (!before.length || s.t - this.buf[0].t < c.settle) continue;
      const drift = Math.max(...before.map(p => Math.abs(p.x - s.x) * aspect));
      if (drift > 1.0 * palm) continue;                               // a wave back and forth is not a swipe
      if (this.requireOpen && !(seg[seg.length - 1].open && seg[seg.length - 2].open && seg[0].open)) continue;   // open at both ends
      const name = dir > 0 ? "right" : "left";
      if (this.backDir === -dir && t < this.backUntil) {             // the hand coming back after a swipe
        this.buf = []; this.coolUntil = t + 300; return null;
      }
      fired = name;
      this.coolUntil = t + c.cooldown; this.backDir = dir; this.backUntil = t + c.back;
      this.buf = []; this.progress = 1;
      break;
    }
    if (!fired) fired = this._fast(t, aspect);
    return fired;
  }

  // Second way to swipe, the same idea as the Air Slides game: the hand is simply FAST and sideways.
  // Speed is in frame widths per second over the last 250 ms. Works when tracking drops frames or the hand is close.
  _fast(t, aspect) {
    const c = this.cfg, b = this.buf;
    const win = b.filter(p => t - p.t <= 250);
    if (win.length < 3) return null;
    const a = win[0], z = win[win.length - 1], sec = (z.t - a.t) / 1000;
    if (sec < 0.08) return null;
    const dx = z.x - a.x, dyW = (z.y - a.y) / aspect;                  // frame widths
    this.progress = Math.max(this.progress, Math.min(1, Math.abs(dx) / sec / c.vmin));
    if (Math.abs(dx) / sec < c.vmin || Math.abs(dx) < 0.15 || Math.abs(dx) < 1.6 * Math.abs(dyW)) return null;
    const dir = Math.sign(dx);
    let same = 0, jump = 0, open = 0;
    for (let j = 1; j < win.length; j++) {
      const st = win[j].x - win[j - 1].x;
      if (Math.sign(st) === dir || st === 0) same++;
      jump = Math.max(jump, Math.abs(st));
    }
    for (const p of win) if (p.open) open++;
    if (jump > 0.7 * Math.abs(dx) || same < 0.7 * (win.length - 1)) return null;
    if (this.requireOpen && (open < 0.6 * win.length || !z.open)) return null;
    const before = b.filter(p => p.t < a.t && p.t >= a.t - 450);
    if (!before.length || a.t - b[0].t < c.settle) return null;
    const palm = Math.min((a.palm + z.palm) / 2, MAX_PALM);
    if (Math.max(...before.map(p => Math.abs(p.x - a.x))) * aspect > 1.0 * palm) return null;
    if (this.backDir === -dir && t < this.backUntil) { this.buf = []; this.coolUntil = t + 300; return null; }
    this.coolUntil = t + c.cooldown; this.backDir = dir; this.backUntil = t + c.back;
    this.buf = []; this.progress = 1;
    return dir > 0 ? "right" : "left";
  }
}

export const SENSITIVITIES = Object.keys(PRESETS);
