// model.js - runs the small neural networks trained by tools/isl/train.py (no ML library needed).
// File format (js/sign/models/*.json): labels, threshold, mean/std (base64 float32), layers [{w, b, rows=outputs, cols=inputs}].
// Network: standardise -> (dense + ReLU) x N -> dense -> softmax(logits / temperature).
// The temperature (fitted on held-out data in training) keeps the probabilities honest, so the "not sure" threshold means what it says.

const f32 = b64 => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Float32Array(u.buffer); };

export async function loadModel(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load the sign model (${r.status})`);
  const m = await r.json();
  const mean = f32(m.mean), std = f32(m.std);
  const layers = m.layers.map(l => ({ w: f32(l.w), b: f32(l.b), rows: l.rows, cols: l.cols }));
  const scratch = layers.map(l => new Float32Array(l.rows));
  return {
    ...m, mean: undefined, std: undefined, layers: undefined,
    inputSize: mean.length,
    predict(x) {
      let a = new Float32Array(x.length);
      for (let i = 0; i < x.length; i++) a[i] = (x[i] - mean[i]) / std[i];
      layers.forEach((l, k) => {
        const out = scratch[k], last = k === layers.length - 1;
        for (let j = 0; j < l.rows; j++) {
          let s = l.b[j];
          const off = j * l.cols;
          for (let i = 0; i < l.cols; i++) s += l.w[off + i] * a[i];
          out[j] = last || s > 0 ? s : 0;
        }
        a = out;
      });
      const T = m.temperature || 1;
      let mx = -Infinity;
      for (let i = 0; i < a.length; i++) { a[i] /= T; mx = Math.max(mx, a[i]); }
      const p = new Float32Array(a.length);
      let sum = 0;
      for (let i = 0; i < a.length; i++) { p[i] = Math.exp(a[i] - mx); sum += p[i]; }
      for (let i = 0; i < p.length; i++) p[i] /= sum;
      return p;
    },
    top(p, k = 3) {
      return [...p].map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]).slice(0, k).map(([v, i]) => ({ label: m.labels[i], p: v }));
    },
  };
}
