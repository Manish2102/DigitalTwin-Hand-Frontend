// core.js - the digital twin itself.
//
// Holds the twin's state, interprets every incoming hand frame (fingers -> gesture),
// acts on it (draw / clear), renders the virtual hand, and talks to the phone.
// Feature modules (simulator, recorder, analytics, predictor) plug in through the
// small event bus below, so the core never needs to know about them.

import { WS_BASE, BACKEND_URL, BACKEND_OVERRIDE, ensureRoom } from "./config.js";
export const ROOM = ensureRoom();

export const PALETTE = ["#4f8cff", "#ff453a", "#34c759", "#ffd60a", "#bf5af2", "#ffffff"];
export const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
                      [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
export const GESTURES = {
  draw:  { label: "☝️ Drawing",   color: "#4f8cff" },
  hover: { label: "✌️ Hover",     color: "#64d2ff" },
  palm:  { label: "✋ Clearing…", color: "#ffd60a" },
  fist:  { label: "✊ Paused",    color: "#bf5af2" },
  idle:  { label: "Unknown pose", color: "#8e8e93" },
  none:  { label: "No hand",      color: "#3a3f4b" },
};
export const SOURCES = { phone: "Live phone", simulation: "Simulation", replay: "Replay" };
export const FINGER_NAMES = ["Thumb", "Index", "Middle", "Ring", "Pinky"];
const PALM_HOLD_MS = 1000;

export const $ = id => document.getElementById(id);
const drawC = $("drawLayer"), handC = $("handLayer");
const dctx = drawC.getContext("2d"), hctx = handC.getContext("2d");

// ------------------------------------------------------------------ state
export const twin = {
  source: "phone",       // where frames come from: phone | simulation | replay
  phones: 0,
  handedness: null,
  landmarks: null,       // latest 21 joints, un-mirrored, normalized 0..1
  fingers: [false, false, false, false, false],
  gesture: "none",
  pointer: null,         // smoothed index fingertip
  color: PALETTE[0],
  width: 6,              // brush size in px
  poseState: null,       // what the phone itself is doing (set by pose.js)
  aspect: 4 / 3,        // camera field-of-view shape
  strokes: [],
  lastUpdate: 0,
  phoneFps: null,
  rtt: null,
  rate: 0,
};
let currentStroke = null, candidate = null, candidateCount = 0;
let palmStart = null, palmDone = false, msgCount = 0;

// -------------------------------------------------------------- event bus
// frame  (raw msg)          every accepted input frame, before processing
// state  ({t,pointer,tip})  after a frame with a hand has been processed
// lost                      hand left the view
// gesture({from,to})        debounced gesture change
// source (name)             data source switched
// event  ({text,kind,time}) human-readable log line
// render ({ctx,rect})       draw overlays on the hand layer
// message (raw msg)         any other message from the phone (e.g. type "pose")
const listeners = {};
export const on = (evt, fn) => (listeners[evt] ??= []).push(fn);
const emit = (evt, data) => (listeners[evt] || []).forEach(fn => fn(data));
export const logEvent = (text, kind = "info") => emit("event", { text, kind, time: new Date() });

// ------------------------------------------------------------- data link
let ws, linkUp = false, lastPhoneMsg = 0;
function connect() {
  ws = new WebSocket(`${WS_BASE}/ws/twin?room=${ROOM}`);
  ws.onopen = () => { if (!linkUp) logEvent(`Linked to backend · room ${ROOM}`, "ok"); linkUp = true; };
  ws.onclose = () => setTimeout(connect, 1000);   // the backend closes long connections; just reconnect
  ws.onerror = () => { if (linkUp) logEvent("Backend link lost - reconnecting", "warn"); linkUp = false; };
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    phoneSeen();                                  // everything in this room comes from the phone
    if (m.type === "hand") ingest(m, "phone");
    else if (m.type === "ping") send({ type: "pong", ts: m.ts });
    else emit("message", m);                      // other sensors (e.g. phone pose) -> feature modules
  };
}
// Presence: the phone pings every second, so "connected" means "heard from it recently".
function phoneSeen() {
  lastPhoneMsg = performance.now();
  if (!twin.phones) {
    twin.phones = 1; logEvent("Phone connected", "ok"); sendFeedback(); updateConn();
    showHint(false);
    emit("phoneConnected");
  }
}
setInterval(() => {
  if (twin.phones && performance.now() - lastPhoneMsg > 3000) {
    twin.phones = 0; logEvent("Phone disconnected", "warn"); updateConn();
  }
}, 1000);
function send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
export const sendToPhone = send;                 // for feature modules with their own messages
export function sendFeedback(event) {
  send({ type: "feedback", gesture: twin.gesture, color: twin.color, poseState: twin.poseState, event });
}
function updateConn() {
  const on = twin.phones > 0;
  $("connDot").classList.toggle("on", on);
  $("conn").textContent = on ? "Phone: connected" : "Phone: offline";
}
// Connect-phone pop-up: shown on first load, hidden once a phone connects or the user closes it.
export function showHint(show) { $("hint").classList.toggle("hidden", !show); }
$("hintClose").onclick = () => showHint(false);
$("hint").onclick = e => { if (e.target === $("hint")) showHint(false); };   // click outside the dialog
$("connPill").onclick = () => showHint(true);
$("connectBtn").onclick = () => showHint(true);

// ------------------------------------------- sync: physical -> virtual
// Single entry point for ALL inputs. The phone, the simulator and the replayer
// all produce the same message shape, so the twin treats them identically.
export function ingest(m, source) {
  if (source !== twin.source) return;          // e.g. live frames ignored during replay
  emit("frame", m);
  msgCount++;
  const now = performance.now();
  twin.lastUpdate = now;
  twin.phoneFps = m.fps ?? null;
  twin.rtt = m.rtt ?? null;
  if (!m.landmarks) { handLost(); return; }
  if (m.aspect) twin.aspect = m.aspect;

  // the front camera is mirrored; flip so the twin moves the same way you do
  const lm = m.mirrored ? m.landmarks.map(([x, y, z]) => [1 - x, y, z]) : m.landmarks;
  twin.landmarks = lm;
  twin.handedness = m.handedness ?? null;

  // understand the state
  twin.fingers = fingersUp(lm);
  const raw = classify(twin.fingers);
  if (raw === candidate) candidateCount++; else { candidate = raw; candidateCount = 1; }
  if (candidateCount >= 3 && raw !== twin.gesture) setGesture(raw);   // debounce flicker

  const tip = lm[8];
  twin.pointer = twin.pointer
    ? [twin.pointer[0] + (tip[0] - twin.pointer[0]) * 0.5, twin.pointer[1] + (tip[1] - twin.pointer[1]) * 0.5]
    : [tip[0], tip[1]];
  emit("state", { t: now, pointer: twin.pointer, tip });

  // act on the state
  if (twin.gesture === "draw") {
    if (!currentStroke) { currentStroke = { color: twin.color, width: twin.width, pts: [] }; twin.strokes.push(currentStroke); }
    currentStroke.pts.push([...twin.pointer]);
    drawLastSegment(currentStroke);
  }
  if (twin.gesture === "palm" && !palmDone) {
    palmStart ??= now;
    if (now - palmStart >= PALM_HOLD_MS) { clearDrawing("palm gesture"); palmDone = true; }
  }
}

function handLost() {
  const had = twin.landmarks;
  twin.landmarks = null; twin.pointer = null;
  candidate = null; candidateCount = 0;
  setGesture("none");
  if (had) emit("lost");
}

function setGesture(g) {
  const from = twin.gesture;
  if (from === g) return;
  twin.gesture = g;
  if (g !== "draw") currentStroke = null;
  if (g !== "palm") { palmStart = null; palmDone = false; }
  sendFeedback();
  emit("gesture", { from, to: g });
  if (g !== "idle") logEvent(`Gesture → ${GESTURES[g].label}`, "gesture");
}

export function setSource(src) {
  if (twin.source === src) return;
  twin.source = src;
  handLost();
  twin.lastUpdate = 0; twin.rtt = null; twin.phoneFps = null;
  $("source").textContent = SOURCES[src];
  updateConn();
  logEvent(`Data source → ${SOURCES[src]}`, "source");
  emit("source", src);
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function fingersUp(lm) {
  const wrist = lm[0];
  // a finger is "up" when its tip is clearly farther from the wrist than its middle joint
  const up = (tip, pip) => dist(lm[tip], wrist) > dist(lm[pip], wrist) * 1.1;
  const thumb = dist(lm[4], lm[9]) > dist(lm[3], lm[9]) * 1.1;
  return [thumb, up(8, 6), up(12, 10), up(16, 14), up(20, 18)];
}
function classify([, i, m, r, p]) {
  if (i && !m && !r && !p) return "draw";
  if (i && m && !r && !p) return "hover";
  if (i && m && r && p) return "palm";
  if (!i && !m && !r && !p) return "fist";
  return "idle";
}

// ---------------------------------------------------------------- actions
export function clearDrawing(reason = "button") {
  twin.strokes = []; currentStroke = null;
  redrawStrokes();
  sendFeedback("cleared");
  logEvent(`Canvas cleared (${reason})`, "action");
}
export function setColor(c) {
  twin.color = c; currentStroke = null;
  let preset = false;
  document.querySelectorAll(".swatch").forEach(x => {
    const match = x.dataset.color === c;
    x.classList.toggle("sel", match);
    preset ||= match;
  });
  $("colorPick").classList.toggle("sel", !preset);
  $("colorPick").style.background = preset ? "" : c;   // rainbow icon unless a custom color is active
  sendFeedback("color");
  logEvent("Pen color changed", "action");
}
export function setWidth(w) {
  twin.width = w; currentStroke = null;
  document.querySelectorAll("#sizes button").forEach(b => b.classList.toggle("sel", +b.dataset.size === w));
}
export function undo() {
  if (!twin.strokes.length) return;
  const removed = twin.strokes.pop();
  if (removed === currentStroke) currentStroke = null;
  redrawStrokes();
  logEvent("Undo last stroke", "action");
}
$("clear").onclick = () => clearDrawing();
$("undo").onclick = undo;
$("customColor").addEventListener("input", e => setColor(e.target.value));
document.querySelectorAll("#sizes button").forEach(b => b.onclick = () => setWidth(+b.dataset.size));
window.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
});
$("save").onclick = () => {
  const a = document.createElement("a");
  a.download = "hand-twin-drawing.png"; a.href = drawC.toDataURL("image/png"); a.click();
};
for (const c of PALETTE) {
  const s = document.createElement("div");
  s.className = "swatch" + (c === twin.color ? " sel" : "");
  s.dataset.color = c;
  s.style.background = c;
  s.onclick = () => setColor(c);
  $("palette").appendChild(s);
}
$("fingers").innerHTML = FINGER_NAMES.map(n => `<div class="finger"><i></i>${n}</div>`).join("");

// -------------------------------------------------------------- rendering
export function viewRect() {
  // largest rectangle with the camera's aspect ratio that fits the viewport
  const W = drawC.clientWidth, H = drawC.clientHeight, pad = 16;
  let w = W - pad * 2, h = w / twin.aspect;
  if (h > H - pad * 2) { h = H - pad * 2; w = h * twin.aspect; }
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}
export const toPx = (p, r) => [r.x + p[0] * r.w, r.y + p[1] * r.h];

function resize() {
  const dpr = window.devicePixelRatio || 1;
  for (const [c, ctx] of [[drawC, dctx], [handC, hctx]]) {
    c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  redrawStrokes();
}
new ResizeObserver(resize).observe($("viewport"));   // also catches toolbar wrapping

function strokeStyle(ctx, s) {
  ctx.strokeStyle = s.color; ctx.lineWidth = s.width ?? 6; ctx.lineCap = "round"; ctx.lineJoin = "round";
}
function drawLastSegment(s) {
  const n = s.pts.length, r = viewRect();
  if (n < 2) return;
  strokeStyle(dctx, s);
  dctx.beginPath();
  dctx.moveTo(...toPx(s.pts[n - 2], r));
  dctx.lineTo(...toPx(s.pts[n - 1], r));
  dctx.stroke();
}
function redrawStrokes() {
  const r = viewRect();
  dctx.clearRect(0, 0, drawC.clientWidth, drawC.clientHeight);
  for (const s of twin.strokes) {
    if (s.pts.length < 2) continue;
    strokeStyle(dctx, s);
    dctx.beginPath();
    dctx.moveTo(...toPx(s.pts[0], r));
    for (const p of s.pts.slice(1)) dctx.lineTo(...toPx(p, r));
    dctx.stroke();
  }
}

function render() {
  const W = handC.clientWidth, H = handC.clientHeight, r = viewRect();
  hctx.clearRect(0, 0, W, H);

  // camera field of view
  hctx.setLineDash([6, 6]); hctx.strokeStyle = "#2a2e37"; hctx.lineWidth = 1;
  hctx.strokeRect(r.x, r.y, r.w, r.h); hctx.setLineDash([]);

  const age = performance.now() - twin.lastUpdate;
  const lm = twin.landmarks;
  if (lm && age < 1000) {
    hctx.globalAlpha = age > 300 ? 0.35 : 1;            // fade when data goes stale
    hctx.strokeStyle = "rgba(232,234,237,.55)"; hctx.lineWidth = 3;
    for (const [a, b] of BONES) {
      hctx.beginPath(); hctx.moveTo(...toPx(lm[a], r)); hctx.lineTo(...toPx(lm[b], r)); hctx.stroke();
    }
    for (let i = 0; i < lm.length; i++) {
      const [x, y] = toPx(lm[i], r);
      const rad = Math.max(3, 6 - lm[i][2] * 40);       // closer joints look bigger
      hctx.fillStyle = [4, 8, 12, 16, 20].includes(i) ? "#4f8cff" : "#e8eaed";
      hctx.beginPath(); hctx.arc(x, y, rad, 0, Math.PI * 2); hctx.fill();
    }
    if (twin.pointer) {
      const [x, y] = toPx(twin.pointer, r);
      hctx.strokeStyle = twin.color; hctx.lineWidth = 2;
      hctx.beginPath(); hctx.arc(x, y, twin.gesture === "draw" ? 10 : 14, 0, Math.PI * 2); hctx.stroke();
      if (twin.gesture === "draw") { hctx.fillStyle = twin.color; hctx.beginPath(); hctx.arc(x, y, 4, 0, Math.PI * 2); hctx.fill(); }
    }
    if (twin.gesture === "palm" && palmStart && !palmDone) {
      const progress = Math.min(1, (performance.now() - palmStart) / PALM_HOLD_MS);
      const [x, y] = toPx(lm[9], r);
      hctx.strokeStyle = "#ffd60a"; hctx.lineWidth = 5;
      hctx.beginPath(); hctx.arc(x, y, 40, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2); hctx.stroke();
    }
    hctx.globalAlpha = 1;
    emit("render", { ctx: hctx, rect: r, age });
  }

  // side panel
  $("gesture").textContent = GESTURES[twin.gesture]?.label ?? twin.gesture;
  document.querySelectorAll(".finger").forEach((el, i) => el.classList.toggle("up", !!lm && twin.fingers[i]));
  $("age").textContent = twin.lastUpdate ? (age < 1000 ? Math.round(age) + " ms" : (age / 1000).toFixed(1) + " s") : "–";
  $("phoneFps").textContent = twin.phoneFps ?? "–";
  $("rtt").textContent = twin.rtt == null ? "–" : twin.rtt + " ms";
  requestAnimationFrame(render);
}

setInterval(() => {
  twin.rate = msgCount; msgCount = 0;
  $("rate").textContent = twin.rate;
}, 1000);

setInterval(() => {
  $("state").textContent = JSON.stringify({
    source: twin.source,
    gesture: twin.gesture,
    handedness: twin.handedness,
    fingersUp: Object.fromEntries(FINGER_NAMES.map((n, i) => [n, twin.fingers[i]])),
    pointer: twin.pointer?.map(v => +v.toFixed(3)) ?? null,
    color: twin.color,
    brush: twin.width,
    phonePose: twin.poseState,
    strokes: twin.strokes.length,
    points: twin.strokes.reduce((n, s) => n + s.pts.length, 0),
    indexTip_xyz: twin.landmarks?.[8] ?? null,
  }, null, 2);
}, 250);

// ------------------------------------------------------- phone address / QR
// The phone opens phone.html with this page's room code (and backend, if overridden).
const phoneLink = new URL("phone.html", location.href);
phoneLink.search = new URLSearchParams({ room: ROOM, ...(BACKEND_OVERRIDE ? { backend: BACKEND_URL } : {}) });
$("phoneUrl").textContent = phoneLink.href;
$("phoneUrl").href = phoneLink.href;
$("roomCode").textContent = ROOM;
if (window.QRCode) new QRCode($("qr"), { text: phoneLink.href, width: 180, height: 180 });
$("newRoom").onclick = () => { location.search = BACKEND_OVERRIDE ? `?backend=${encodeURIComponent(BACKEND_URL)}` : ""; };

// ------------------------------------------------------------------ start
export function start() {
  resize();
  connect();
  requestAnimationFrame(render);
}
