// features.js - turns MediaPipe hand + pose landmarks into the numbers the sign models read.
// The SAME maths runs in Python for training (tools/isl/features.py); tools/isl/check_features.mjs checks they agree.
//
// One frame (FRAME_DIM = 96 numbers):
//   for each hand slot (0 = the signer's right hand, 1 = left; assigned by the nearest pose wrist):
//     present (1), wrist position in body units (2), 20 hand points relative to the wrist in hand units (40)
//   elbows and pose wrists, both sides, in body units (8); nose in body units (2)
// Body units: origin between the shoulders, 1 = shoulder width. Hand units: 1 = wrist to middle-finger knuckle.
// x is multiplied by the image aspect ratio first, so x and y are in the same units.
// A sign (sequence) = from the first to the last frame with a raised hand (wrist above REST_Y), resampled to SEQ_T
// steps, so signing speed and the time spent resting before and after do not matter.

export const FRAME_DIM = 96, SEQ_T = 16;
// a hand counts as "signing" when its wrist is above this line (body units below the shoulders); lower = resting
export const REST_Y = 1.25;
export const isActive = f => (f[0] > 0 && f[2] < REST_Y) || (f[43] > 0 && f[45] < REST_Y);
const L_SH = 11, R_SH = 12, L_EL = 13, R_EL = 14, L_WR = 15, R_WR = 16, NOSE = 0;

// anchors from the pose: shoulder midpoint and width (null if the shoulders are not visible)
export function anchors(pose, aspect) {
  if (!pose) return null;
  const l = pose[L_SH], r = pose[R_SH];
  if (!l || !r || !isFinite(l[0]) || !isFinite(r[0])) return null;
  const s = Math.hypot((l[0] - r[0]) * aspect, l[1] - r[1]);
  if (!(s > 0.02)) return null;
  return { cx: (l[0] + r[0]) / 2, cy: (l[1] + r[1]) / 2, s };
}

const body = (p, a, aspect) => [((p[0] - a.cx) * aspect) / a.s, (p[1] - a.cy) / a.s];

// hands: array of 21-point hands ([x,y,z] image coords); pose: 33 points or null; a: anchors
export function frameFeatures(hands, pose, a, aspect) {
  const f = new Float32Array(FRAME_DIM);
  // assign hands to slots by distance to the pose wrists (slot 0 = signer's right = pose 16)
  const slots = [null, null];
  const valid = (hands ?? []).filter(h => h && isFinite(h[0][0]));
  if (pose && valid.length) {
    const wr = [pose[R_WR], pose[L_WR]];
    const d = (h, k) => Math.hypot((h[0][0] - wr[k][0]) * aspect, h[0][1] - wr[k][1]);
    if (valid.length >= 2) {
      const [h0, h1] = valid;
      if (d(h0, 0) + d(h1, 1) <= d(h0, 1) + d(h1, 0)) { slots[0] = h0; slots[1] = h1; } else { slots[0] = h1; slots[1] = h0; }
    } else {
      const h = valid[0];
      slots[d(h, 0) <= d(h, 1) ? 0 : 1] = h;
    }
  } else if (valid.length) {                                     // no pose: by image side (signer's right is image left)
    const sorted = [...valid].sort((p, q) => p[0][0] - q[0][0]);
    slots[0] = sorted[0]; if (sorted[1]) slots[1] = sorted[1];
  }
  let o = 0;
  for (let k = 0; k < 2; k++) {
    const h = slots[k];
    if (!h) { o += 43; continue; }
    f[o++] = 1;
    const w = body(h[0], a, aspect); f[o++] = w[0]; f[o++] = w[1];
    const hs = Math.hypot((h[9][0] - h[0][0]) * aspect, h[9][1] - h[0][1]) || 1e-3;
    for (let i = 1; i < 21; i++) { f[o++] = ((h[i][0] - h[0][0]) * aspect) / hs; f[o++] = (h[i][1] - h[0][1]) / hs; }
  }
  for (const i of [R_EL, L_EL, R_WR, L_WR, NOSE]) {
    const p = pose?.[i];
    if (p && isFinite(p[0])) { const b = body(p, a, aspect); f[o++] = b[0]; f[o++] = b[1]; } else o += 2;
  }
  return f;
}

// frames: [{ f: Float32Array(FRAME_DIM) }] in time order -> Float32Array(SEQ_T * FRAME_DIM), or null if too short
export function sequenceFeatures(frames) {
  const has = fr => isActive(fr.f);
  let a = 0, b = frames.length - 1;
  while (a <= b && !has(frames[a])) a++;
  while (b >= a && !has(frames[b])) b--;
  if (b - a + 1 < 4) return null;
  const seg = frames.slice(a, b + 1).map(fr => Float32Array.from(fr.f));
  // a hand missing for a few frames: copy it from the nearest frame that has it (up to 4 frames away)
  for (const off of [0, 43]) {
    const orig = seg.map(v => v[off] > 0), src = seg.map(v => v.slice(off, off + 43));
    for (let i = 0; i < seg.length; i++) {
      if (orig[i]) continue;
      let found = -1;
      for (let d = 1; d <= 4 && found < 0; d++) {
        if (i - d >= 0 && orig[i - d]) found = i - d;
        else if (i + d < seg.length && orig[i + d]) found = i + d;
      }
      if (found >= 0) seg[i].set(src[found], off);
    }
  }
  const out = new Float32Array(SEQ_T * FRAME_DIM), n = seg.length;
  for (let t = 0; t < SEQ_T; t++) {
    const pos = (t * (n - 1)) / (SEQ_T - 1), i = Math.floor(pos), u = pos - i, j = Math.min(n - 1, i + 1);
    for (let k = 0; k < FRAME_DIM; k++) out[t * FRAME_DIM + k] = seg[i][k] * (1 - u) + seg[j][k] * u;
  }
  return out;
}
