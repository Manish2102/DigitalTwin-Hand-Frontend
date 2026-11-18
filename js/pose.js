// pose.js - a second digital twin: the phone itself.
//
// The phone streams its raw orientation (alpha, beta, gamma in degrees) and the
// strongest shake since its last update. This module:
//   1. mirrors the phone as a 3D model (sync physical -> virtual)
//   2. works out what the phone is doing: flat, upright, landscape... (intelligence)
//   3. acts on it: a shake clears the canvas (action)
//   4. tells the phone what it concluded (feedback, virtual -> physical)

import { twin, on, logEvent, sendFeedback, clearDrawing, $ } from "./core.js";

const SHAKE_MS2 = 15;          // linear acceleration that counts as a shake
const SHAKE_COOLDOWN_MS = 1500;
const STALE_MS = 1500;
const deg = Math.PI / 180;

let latest = null, lastMsg = 0, alpha0 = 0, lastShake = 0, demoTimer = null;

// ---------------------------------------------------------------- math
// W3C device orientation: R = Rz(alpha) * Rx(beta) * Ry(gamma) maps phone axes
// (x right, y top, z out of the screen) to earth axes (x east, y north, z up).
function rotation(alpha, beta, gamma) {
  const [ca, sa] = [Math.cos(alpha * deg), Math.sin(alpha * deg)];
  const [cb, sb] = [Math.cos(beta * deg), Math.sin(beta * deg)];
  const [cg, sg] = [Math.cos(gamma * deg), Math.sin(gamma * deg)];
  return [
    [ca * cg - sa * sb * sg, -sa * cb, ca * sg + sa * sb * cg],
    [sa * cg + ca * sb * sg,  ca * cb, sa * sg - ca * sb * cg],
    [-cb * sg,                sb,      cb * cg],
  ];
}

// CSS has y pointing down, so flip y on both sides (M = S R S, S = diag(1,-1,1)),
// then write it column-major for matrix3d().
function cssMatrix(R) {
  const s = [1, -1, 1];
  const m = (i, j) => s[i] * R[i][j] * s[j];
  return `matrix3d(${m(0,0)},${m(1,0)},${m(2,0)},0,${m(0,1)},${m(1,1)},${m(2,1)},0,${m(0,2)},${m(1,2)},${m(2,2)},0,0,0,0,1)`;
}

// Which way is "up" from the phone's point of view? (third row of R)
function classify(R) {
  const [ux, uy, uz] = R[2];
  const tilt = Math.round(Math.acos(Math.max(-1, Math.min(1, uz))) / deg);
  let state;
  if (uz > 0.85) state = "📱 Flat, screen up";
  else if (uz < -0.85) state = "🔽 Flat, screen down";
  else if (uy > 0.75) state = "⬆️ Upright (portrait)";
  else if (uy < -0.75) state = "⬇️ Upside down";
  else if (Math.abs(ux) > 0.75) state = "↔️ Landscape";
  else state = "↗️ Tilted";
  return { state, tilt };
}

// ------------------------------------------------------------- ingest
function handlePose(m) {
  latest = m;
  lastMsg = performance.now();
  const { state } = classify(rotation(m.alpha ?? 0, m.beta ?? 0, m.gamma ?? 0));
  if (state !== twin.poseState) {
    twin.poseState = state;
    sendFeedback();                              // tell the phone what the twin sees
    logEvent(`Phone pose → ${state}`, "gesture");
  }
  if ($("shakeOn").checked && (m.acc ?? 0) > SHAKE_MS2 && lastMsg - lastShake > SHAKE_COOLDOWN_MS) {
    lastShake = lastMsg;
    logEvent(`Phone shake detected (${m.acc} m/s²)`, "action");
    clearDrawing("phone shake");
  }
}

on("message", m => { if (m.type === "pose" && !demoTimer) handlePose(m); });

// -------------------------------------------------------------- render
function render() {
  const fresh = latest && performance.now() - lastMsg < STALE_MS;
  $("poseStage").classList.toggle("stale", !fresh);
  if (latest) {
    const a = (latest.alpha ?? 0) - alpha0;
    const R = rotation(a, latest.beta ?? 0, latest.gamma ?? 0);
    $("phone3d").style.transform = cssMatrix(R);
    const { tilt } = classify(R);
    $("pAlpha").textContent = `${Math.round(((a % 360) + 360) % 360)}°`;
    $("pBeta").textContent = `${Math.round(latest.beta ?? 0)}°`;
    $("pGamma").textContent = `${Math.round(latest.gamma ?? 0)}°`;
    $("pTilt").textContent = `${tilt}°`;
    $("pState").textContent = fresh ? twin.poseState : "No pose data";
  }
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

// ------------------------------------------------------------- controls
$("poseRecenter").onclick = () => {
  alpha0 = latest?.alpha ?? 0;                   // make the current heading "straight ahead"
  logEvent("Phone pose recentered", "action");
};

// Demo: a gently rocking virtual phone, so the twin can be shown without hardware.
$("poseDemo").onclick = () => {
  if (demoTimer) {
    clearInterval(demoTimer); demoTimer = null;
    $("poseDemo").classList.remove("active"); $("poseDemo").textContent = "▶ Demo";
    return;
  }
  const t0 = performance.now();
  demoTimer = setInterval(() => {
    const t = (performance.now() - t0) / 1000;
    handlePose({ type: "pose", alpha: 25 * Math.sin(t * 0.5), beta: 35 + 35 * Math.sin(t * 0.7),
                 gamma: 30 * Math.sin(t * 1.1), acc: 0 });
  }, 50);
  $("poseDemo").classList.add("active"); $("poseDemo").textContent = "■ Stop demo";
};
