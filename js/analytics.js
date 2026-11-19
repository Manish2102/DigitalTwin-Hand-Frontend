// analytics.js - monitoring and insights.
//
// Turns the raw stream into numbers people care about: how fast and how steady
// the hand is, how healthy the data link is, how time is spent per gesture,
// plus a live chart and an event log.

import { twin, on, GESTURES, viewRect, $ } from "./core.js";
import { icon } from "./icons.js";
import { toast } from "./ui.js";

const SAMPLE_MS = 250, HISTORY = 120;           // chart keeps 30 s
let last = null, speed = 0, tips = [], stalls = 0;
let gestureMs = {};
const series = { speed: [], rtt: [] };

on("state", s => {
  if (last) {
    const dt = (s.t - last.t) / 1000;
    if (dt > 0.25) {
      stalls++;                                   // data gap while the hand was visible
    } else if (dt > 0) {
      const r = viewRect();
      const v = Math.hypot((s.pointer[0] - last.p[0]) * r.w, (s.pointer[1] - last.p[1]) * r.h) / dt;
      speed = speed * 0.8 + v * 0.2;
    }
  }
  last = { t: s.t, p: [...s.pointer] };
  tips.push(s.tip);
  if (tips.length > 20) tips.shift();
});
const reset = () => { last = null; tips = []; speed = 0; };
on("lost", reset);
on("source", reset);

// steadiness: how far each raw fingertip sample jumps away from the line through
// its neighbours. Smooth motion scores high; sensor noise or shaky hands score low.
function steadiness() {
  if (tips.length < 5) return null;
  let sum = 0;
  for (let i = 1; i < tips.length - 1; i++) {
    const mx = (tips[i - 1][0] + tips[i + 1][0]) / 2, my = (tips[i - 1][1] + tips[i + 1][1]) / 2;
    sum += Math.hypot(tips[i][0] - mx, tips[i][1] - my);
  }
  const jitter = sum / (tips.length - 2);
  return Math.round(Math.max(0, Math.min(100, 100 - (jitter / 0.01) * 100)));
}

// ------------------------------------------------------------ periodic update
setInterval(() => {
  const hand = !!twin.landmarks;
  if (hand) gestureMs[twin.gesture] = (gestureMs[twin.gesture] || 0) + SAMPLE_MS;

  const st = hand ? steadiness() : null;
  $("aSpeed").textContent = hand ? Math.round(speed) : "–";
  $("aSteady").textContent = st == null ? "–" : st;
  $("aStalls").textContent = stalls;
  $("aStrokes").textContent = twin.strokes.length;

  series.speed.push(hand ? speed : 0);
  series.rtt.push(twin.rtt ?? 0);
  for (const k in series) if (series[k].length > HISTORY) series[k].shift();
  drawChart();
  drawGestureBar();
}, SAMPLE_MS);

function drawGestureBar() {
  const total = Object.values(gestureMs).reduce((a, b) => a + b, 0);
  const keys = ["draw", "hover", "palm", "fist", "idle"].filter(k => gestureMs[k]);
  $("gBar").innerHTML = total
    ? keys.map(k => `<span style="width:${(gestureMs[k] / total) * 100}%;background:${GESTURES[k].color}"></span>`).join("")
    : "";
  $("gLegend").innerHTML = total
    ? keys.map(k => `<span><i style="background:${GESTURES[k].color}"></i>${GESTURES[k].label} ${(gestureMs[k] / 1000).toFixed(1)}s</span>`).join("")
    : `<span class="subtle">Time per gesture appears here once a hand is tracked</span>`;
}

function drawChart() {
  const c = $("chart"), dpr = window.devicePixelRatio || 1;
  const W = c.clientWidth, H = c.clientHeight;
  if (!W) return;                                 // section hidden
  if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = "#232932"; ctx.lineWidth = 1;           // light horizontal grid
  for (const f of [0.25, 0.5, 0.75]) { ctx.beginPath(); ctx.moveTo(0, Math.round(H * f) + .5); ctx.lineTo(W, Math.round(H * f) + .5); ctx.stroke(); }
  if (!series.speed.some(v => v > 0) && !series.rtt.some(v => v > 0)) {
    ctx.fillStyle = "#868e9a"; ctx.font = "12px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("No data yet", W / 2, H / 2 + 4);
    return;
  }
  const line = (data, max, color) => {
    if (data.length < 2) return;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
    data.forEach((v, i) => {
      const x = W - (data.length - 1 - i) * (W / (HISTORY - 1));
      const y = H - 4 - (Math.min(v, max) / max) * (H - 8);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  };
  line(series.speed, Math.max(400, ...series.speed), "#7b96ff");
  line(series.rtt, Math.max(100, ...series.rtt), "#e0a83a");
}

$("aReset").onclick = () => {
  gestureMs = {}; stalls = 0; series.speed.length = 0; series.rtt.length = 0;
  toast("Analytics reset", "info");
};

// ------------------------------------------------------------------ event log
const EMPTY_LOG = `<li class="empty">${icon("list", 22)}<span class="empty-title">No activity yet</span>
  <span class="empty-desc">Connections, gestures and actions will appear here.</span></li>`;
$("log").innerHTML = EMPTY_LOG;
on("event", ({ text, kind, time }) => {
  const log = $("log");
  log.querySelector(".empty")?.remove();
  const li = document.createElement("li");
  li.className = `log-item ${kind}`;
  const t = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  li.innerHTML = `<time>${t}</time><span class="dot"></span><span></span>`;
  li.lastChild.textContent = text;
  log.prepend(li);
  while (log.children.length > 60) log.lastChild.remove();
});
