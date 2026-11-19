// camera.js - the laptop's own webcam as a hand sensor for the Arcade.
//
// The camera picture never leaves the browser: MediaPipe's hand landmarker runs here (WebAssembly, on the GPU when
// it can) and only the 21 hand points are used. They go into the same input layer as the phone's hand frames
// (input.js feedHand), so every hand game works with either camera. Same library and model as the phone page.

import { feedHand, setCameraActive, inputs } from "./input.js";
import { BONES } from "../core.js";

const VER = "0.10.14";
const LIB = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/vision_bundle.mjs`;
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/wasm`;
const MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let state = "off", message = "", stream = null, video = null, landmarker = null, raf = 0, lastT = -1, hands = [];
let preview = null, fps = 0, frames = 0, fpsT = 0;
const subs = [];
export const onCamera = fn => subs.push(fn);
export const cameraState = () => state;          // off | starting | on | error
export const cameraMessage = () => message;
export const cameraLive = () => state === "on";
export const cameraFps = () => fps;
export const handsSeen = () => hands.length;
const set = (s, msg = "") => { state = s; message = msg; subs.forEach(fn => fn(state, message)); };

export function mountPreview(canvas) { preview = canvas; }

export async function startCamera() {
  if (state === "on") return true;
  if (state === "starting") return false;
  if (!navigator.mediaDevices?.getUserMedia) {
    set("error", "The camera needs a secure page (https or localhost). The mouse still works.");
    return false;
  }
  set("starting", "Asking for the camera...");
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false });
  } catch (e) {
    set("error", e.name === "NotAllowedError" ? "Camera blocked. Allow it in the address bar, or play with the mouse."
               : e.name === "NotFoundError" ? "No camera found on this computer. The mouse still works."
               : e.name === "NotReadableError" ? "The camera is busy in another app or tab. Close it and try again."
               : `Could not start the camera (${e.name}).`);
    return false;
  }
  if (!video) {
    video = document.createElement("video");
    video.muted = true; video.playsInline = true;
    video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;top:0";
    document.body.appendChild(video);
  }
  video.srcObject = stream;
  try { await video.play(); } catch {}
  if (!landmarker) {
    set("starting", "Loading the hand model (about 8 MB, only the first time)...");
    try {
      const { FilesetResolver, HandLandmarker } = await import(LIB);
      const vision = await FilesetResolver.forVisionTasks(WASM);
      const opts = delegate => ({ baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: "VIDEO", numHands: 2,
                                  minHandDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      try { landmarker = await HandLandmarker.createFromOptions(vision, opts("GPU")); }
      catch { landmarker = await HandLandmarker.createFromOptions(vision, opts("CPU")); }
    } catch (e) {
      stopTracks();
      set("error", "Could not load the hand model. It needs internet access to cdn.jsdelivr.net and storage.googleapis.com.");
      return false;
    }
  }
  if (!stream) return false;                        // stopped while the model was loading
  setCameraActive(true);
  set("on", "Show one hand to the camera");
  lastT = -1; fpsT = performance.now(); frames = 0;
  raf = requestAnimationFrame(detect);
  return true;
}

function stopTracks() { stream?.getTracks().forEach(t => t.stop()); stream = null; if (video) video.srcObject = null; }

export function stopCamera() {
  if (state === "off") return;
  cancelAnimationFrame(raf);
  stopTracks();
  hands = [];
  setCameraActive(false);
  feedHand(1, null);
  drawPreview();
  set("off");
}

function detect(now) {
  if (state !== "on") return;
  raf = requestAnimationFrame(detect);
  if (video.readyState < 2 || video.currentTime === lastT) return;
  lastT = video.currentTime;
  let res;
  try { res = landmarker.detectForVideo(video, now); } catch { return; }
  hands = res.landmarks ?? [];
  const aspect = (video.videoWidth || 4) / (video.videoHeight || 3);
  // the first hand drives the game; the count is used by the office twin
  feedHand(1, hands.length ? hands[0].map(p => [p.x, p.y, p.z]) : null, { mirrored: true, aspect, hands: hands.length });
  frames++;
  if (now - fpsT > 1000) { fps = Math.round(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now; }
  drawPreview();
}

// small mirrored picture with the tracked skeleton, for the side panel
function drawPreview() {
  if (!preview) return;
  const c = preview.getContext("2d"), w = preview.width, h = preview.height;
  c.fillStyle = "#0b0d11"; c.fillRect(0, 0, w, h);
  if (state !== "on") return;
  c.save(); c.translate(w, 0); c.scale(-1, 1); c.drawImage(video, 0, 0, w, h); c.restore();
  c.fillStyle = "rgba(11,13,17,.3)"; c.fillRect(0, 0, w, h);
  const q = inputs[1].ptr;
  hands.forEach((L, k) => {
    c.strokeStyle = k ? "#e0a83a" : "#7b96ff"; c.lineWidth = 2.5; c.lineCap = "round";
    for (const [a, b] of BONES) { c.beginPath(); c.moveTo((1 - L[a].x) * w, L[a].y * h); c.lineTo((1 - L[b].x) * w, L[b].y * h); c.stroke(); }
    c.fillStyle = "#e7e9ec";
    for (const p of L) { c.beginPath(); c.arc((1 - p.x) * w, p.y * h, 2.5, 0, 7); c.fill(); }
    if (k === 0) {                                   // the pinch point
      const x = (1 - (L[4].x + L[8].x) / 2) * w, y = (L[4].y + L[8].y) / 2 * h;
      c.beginPath(); c.arc(x, y, q.pinch ? 6 : 9, 0, 7);
      c.strokeStyle = q.pinch ? "#46c068" : "#e7e9ec"; c.lineWidth = 2; c.stroke();
    }
  });
}

export function gestureLabel() {
  if (state !== "on") return "";
  const q = inputs[1].ptr;
  if (!hands.length) return "No hand in view";
  const g = q.pinch ? "Pinch" : q.fist ? "Fist" : q.open ? "Open palm" : "Point";
  return hands.length > 1 ? `${g} - ${hands.length} hands` : g;
}
