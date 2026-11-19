// mesh.js - turns a depth map + object mask into a solid 3D "relief" mesh.
// Pure functions (no DOM, no Three.js) so the geometry can be unit-tested in Node.
//
// Coordinates: the object's bounding box is 1 unit wide, x to the right, y up, z towards the viewer.
// The front surface is displaced by depth; a flat back and side walls close the shape,
// so the result is watertight (a solid you can 3D-print) and not just a sheet.

/** Bilinear resample of a single-channel image (src sw*sh) to dw*dh. */
export function resample(src, sw, sh, dw, dh) {
  const out = new Float32Array(dw * dh);
  for (let j = 0; j < dh; j++) {
    const fy = dh === 1 ? 0 : (j / (dh - 1)) * (sh - 1), y0 = Math.floor(fy), y1 = Math.min(sh - 1, y0 + 1), ty = fy - y0;
    for (let i = 0; i < dw; i++) {
      const fx = dw === 1 ? 0 : (i / (dw - 1)) * (sw - 1), x0 = Math.floor(fx), x1 = Math.min(sw - 1, x0 + 1), tx = fx - x0;
      const a = src[y0 * sw + x0], b = src[y0 * sw + x1], c = src[y1 * sw + x0], d = src[y1 * sw + x1];
      out[j * dw + i] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    }
  }
  return out;
}

/** Clean up a soft mask: blur once, then threshold. Removes speckles and ragged edges. */
export function refineMask(mask, w, h, threshold = 0.5) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      s += mask[yy * w + xx]; n++;
    }
    out[y * w + x] = s / n > threshold ? 1 : 0;
  }
  return out;
}

/** Rescale depth so that the masked area spans 0 (farthest) to 1 (nearest), ignoring outliers. */
export function normalizeDepth(depth, mask, lowPct = 0.02, highPct = 0.98) {
  const vals = [];
  for (let i = 0; i < depth.length; i++) if (mask[i]) vals.push(depth[i]);
  if (!vals.length) return new Float32Array(depth.length);
  vals.sort((a, b) => a - b);
  const lo = vals[Math.floor((vals.length - 1) * lowPct)], hi = vals[Math.floor((vals.length - 1) * highPct)];
  const span = hi - lo || 1;
  const out = new Float32Array(depth.length);
  for (let i = 0; i < depth.length; i++) out[i] = Math.min(1, Math.max(0, (depth[i] - lo) / span));
  return out;
}

/** Blur the depth using only masked neighbours, so the background never bleeds into the object. */
export function smoothDepth(depth, mask, w, h, passes) {
  let cur = depth;
  for (let p = 0; p < passes; p++) {
    const next = new Float32Array(cur.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h || !mask[yy * w + xx]) continue;
        s += cur[yy * w + xx]; n++;
      }
      next[i] = s / n;
    }
    cur = next;
  }
  return cur;
}

/**
 * Build the mesh, cropped to the object's bounding box so the model fills the view and its width
 * is the object's width (1 unit).
 *  depth  Float32Array gw*gh, normalised 0..1 (1 = nearest), already smoothed
 *  mask   Uint8Array gw*gh, 1 = object
 *  opts   strength   how far the nearest point sticks out, as a fraction of the object's width
 *         thickness  how far the flat back sits behind the farthest point (same unit)
 *         maxJump    cut triangles where neighbouring depth jumps more than this (stops stretched sheets)
 *         solid      add back and side walls
 *         pad        extra cells kept around the object
 * Returns { positions, uvs, indices, triangles, bounds } or null when the mask is empty.
 * UVs point into the full picture, so the photo texture needs no cropping.
 */
export function buildRelief(depth, mask, gw, gh, opts = {}) {
  const { strength = 0.35, thickness = 0.06, maxJump = 0.2, solid = true, pad = 1 } = opts;

  // bounding box of the object
  let i0 = gw, i1 = -1, j0 = gh, j1 = -1;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) if (mask[j * gw + i]) {
    if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j;
  }
  if (i1 < 0) return null;
  i0 = Math.max(0, i0 - pad); j0 = Math.max(0, j0 - pad); i1 = Math.min(gw - 1, i1 + pad); j1 = Math.min(gh - 1, j1 + pad);
  const lw = Math.max(2, i1 - i0 + 1), lh = Math.max(2, j1 - j0 + 1), N = lw * lh;
  const cell = 1 / (lw - 1), height = (lh - 1) * cell;           // square cells; the box is 1 wide and `height` tall
  const at = (i, j) => (j0 + j) * gw + (i0 + i);

  const front = new Float32Array(N * 3), uvs = new Float32Array(N * 2);
  for (let j = 0; j < lh; j++) for (let i = 0; i < lw; i++) {
    const k = j * lw + i, g = at(i, j);
    front[k * 3] = i * cell - 0.5;
    front[k * 3 + 1] = height / 2 - j * cell;
    front[k * 3 + 2] = depth[g] * strength;
    uvs[k * 2] = (i0 + i) / (gw - 1);
    uvs[k * 2 + 1] = 1 - (j0 + j) / (gh - 1);
  }

  // front surface, triangle by triangle: a triangle is kept when its three corners are on the object and the
  // surface is not torn there. Each quad is split along the diagonal that keeps more of it, which halves the
  // stair-stepping along the silhouette compared with whole quads.
  const tris = [];
  const inV = (k) => mask[at(k % lw, (k / lw) | 0)] === 1;
  const dV = (k) => depth[at(k % lw, (k / lw) | 0)];
  const ok = (a, b, c) => {
    if (!(inV(a) && inV(b) && inV(c))) return false;
    const x = dV(a), y = dV(b), z = dV(c);
    return Math.max(x, y, z) - Math.min(x, y, z) <= maxJump;
  };
  for (let j = 0; j < lh - 1; j++) for (let i = 0; i < lw - 1; i++) {
    const tl = j * lw + i, tr = tl + 1, bl = tl + lw, br = bl + 1;
    // split A: diagonal top-left to bottom-right; split B: diagonal bottom-left to top-right (all counter-clockwise from the front)
    const A = [[tl, bl, br], [tl, br, tr]].filter(t => ok(...t));
    const B = [[tl, bl, tr], [bl, br, tr]].filter(t => ok(...t));
    for (const t of (B.length > A.length ? B : A)) tris.push(...t);
  }

  const positions = solid ? new Float32Array(N * 6) : front;
  let outUvs = uvs;
  const indices = [...tris];
  if (solid) {
    positions.set(front);
    for (let k = 0; k < N; k++) {
      positions[(N + k) * 3] = front[k * 3];
      positions[(N + k) * 3 + 1] = front[k * 3 + 1];
      positions[(N + k) * 3 + 2] = -thickness;
    }
    outUvs = new Float32Array(N * 4); outUvs.set(uvs); outUvs.set(uvs, N * 2);   // back and walls reuse the front colours
    // back face: same triangles, reversed winding, on the back vertices
    for (let t = 0; t < tris.length; t += 3) indices.push(N + tris[t], N + tris[t + 2], N + tris[t + 1]);
    // side walls: every directed edge whose opposite edge is missing lies on the silhouette
    const has = new Set();
    for (let t = 0; t < tris.length; t += 3) for (let e = 0; e < 3; e++) has.add(tris[t + e] * N + tris[t + (e + 1) % 3]);
    for (let t = 0; t < tris.length; t += 3) for (let e = 0; e < 3; e++) {
      const a = tris[t + e], b = tris[t + (e + 1) % 3];
      if (has.has(b * N + a)) continue;
      indices.push(a, N + a, N + b, a, N + b, b);
    }
  }
  return {
    positions, uvs: outUvs, indices: new Uint32Array(indices), triangles: indices.length / 3,
    bounds: { width: 1, height, depth: strength + (solid ? thickness : 0) },
  };
}
