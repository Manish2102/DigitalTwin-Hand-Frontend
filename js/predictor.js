// predictor.js - a predictive twin.
//
// From the fingertip's recent velocity the twin forecasts where it will be a short
// time ahead (the "look-ahead"), draws that as a ghost cursor, and then checks
// every forecast against what really happened. It reports the forecast error and
// compares it with "no prediction" (assuming the finger stays put).

import { twin, on, viewRect, toPx, $ } from "./core.js";

let horizonMs = 150;
let prev = null, vel = [0, 0], predicted = null, queue = [];
let errPred = null, errBase = null;

on("state", s => {
  const p = s.pointer;
  if (prev) {
    const dt = (s.t - prev.t) / 1000;
    if (dt > 0 && dt < 0.25) {
      const v = [(p[0] - prev.p[0]) / dt, (p[1] - prev.p[1]) / dt];
      vel = [vel[0] * 0.6 + v[0] * 0.4, vel[1] * 0.6 + v[1] * 0.4];
    } else vel = [0, 0];
  }
  prev = { t: s.t, p: [...p] };
  predicted = [p[0] + vel[0] * horizonMs / 1000, p[1] + vel[1] * horizonMs / 1000];

  // score forecasts whose moment has arrived
  const r = viewRect();
  const px = (a, b) => Math.hypot((a[0] - b[0]) * r.w, (a[1] - b[1]) * r.h);
  while (queue.length && queue[0].due <= s.t) {
    const q = queue.shift();
    if (s.t - q.due > 100) continue;           // too stale to compare fairly
    const ep = px(q.pred, p), eb = px(q.base, p);
    errPred = errPred == null ? ep : errPred * 0.95 + ep * 0.05;
    errBase = errBase == null ? eb : errBase * 0.95 + eb * 0.05;
  }
  if (horizonMs > 0) queue.push({ due: s.t + horizonMs, pred: predicted, base: [...p] });
});

const reset = () => { prev = null; vel = [0, 0]; predicted = null; queue = []; };
on("lost", reset);
on("source", reset);

on("render", ({ ctx, rect, age }) => {
  if (!$("predOn").checked || !predicted || !twin.pointer || age > 300 || horizonMs === 0) return;
  const [x0, y0] = toPx(twin.pointer, rect), [x1, y1] = toPx(predicted, rect);
  ctx.save();
  ctx.setLineDash([4, 4]); ctx.strokeStyle = "#ffd60a"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.beginPath(); ctx.arc(x1, y1, 12, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
});

$("predH").oninput = e => {
  horizonMs = +e.target.value;
  $("predHVal").textContent = horizonMs + " ms";
  queue = []; errPred = errBase = null;
};

setInterval(() => {
  $("predErr").textContent = errPred == null ? "–" : errPred.toFixed(1) + " px";
  $("baseErr").textContent = errBase == null ? "–" : errBase.toFixed(1) + " px";
  $("predGain").textContent = errPred == null || !errBase
    ? "–"
    : `${Math.round((1 - errPred / errBase) * 100)}%`;
}, 250);
