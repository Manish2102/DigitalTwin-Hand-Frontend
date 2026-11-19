// vision.worker.js - MediaPipe hand (and optionally pose) tracking off the main thread.
//
// The page sends camera frames as ImageBitmaps; this worker returns landmarks. Running here means slow frames can
// never delay what the page is doing (a slide change, a redraw). Same library and models as the rest of the app.
//
// messages in:  { type: "init", hands: true, pose: false, numHands: 2 }
//               { type: "frame", bitmap, ts }            (the bitmap is transferred and closed here)
// messages out: { type: "ready", delegate } | { type: "error", message }
//               { type: "result", ts, hands: [[[x,y,z] x21], ...], handed: ["Left"|"Right"], pose: [[x,y,z,v] x33] | null, ms }

const VER = "0.10.14";
const BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`;
const HAND_MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const POSE_MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// MediaPipe's WASM loader calls importScripts, which module workers do not have: load those scripts synchronously.
self.importScripts = (...urls) => {
  for (const u of urls) {
    const x = new XMLHttpRequest();
    x.open("GET", u, false); x.send();
    if (x.status !== 200) throw new Error(`Could not load ${u} (${x.status})`);
    (0, eval)(x.responseText);
  }
};
const lib = import(`${BASE}/vision_bundle.mjs`);

let hands = null, pose = null, delegate = "";

async function create(Task, fs, opts) {
  try { delegate = "GPU"; return await Task.createFromOptions(fs, { ...opts(true), canvas: new OffscreenCanvas(1, 1) }); }
  catch { delegate = "CPU"; return await Task.createFromOptions(fs, opts(false)); }
}

onmessage = async e => {
  const m = e.data;
  if (m.type === "init") {
    try {
      const { FilesetResolver, HandLandmarker, PoseLandmarker } = await lib;
      const fs = await FilesetResolver.forVisionTasks(`${BASE}/wasm`);
      if (m.hands !== false) {
        hands = await create(HandLandmarker, fs, gpu => ({
          baseOptions: { modelAssetPath: HAND_MODEL, delegate: gpu ? "GPU" : "CPU" }, runningMode: "VIDEO",
          numHands: m.numHands ?? 2, minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 }));
      }
      if (m.pose) {
        pose = await create(PoseLandmarker, fs, gpu => ({
          baseOptions: { modelAssetPath: POSE_MODEL, delegate: gpu ? "GPU" : "CPU" }, runningMode: "VIDEO" }));
      }
      postMessage({ type: "ready", delegate });
    } catch (err) {
      postMessage({ type: "error", message: String(err?.message ?? err) });
    }
  } else if (m.type === "frame") {
    const t0 = performance.now();
    let h = null, p = null, error = null;
    try {
      if (hands) h = hands.detectForVideo(m.bitmap, m.ts);
      if (pose) p = pose.detectForVideo(m.bitmap, m.ts);
    } catch (err) { error = String(err?.message ?? err); }
    m.bitmap.close();
    postMessage({
      type: "result", ts: m.ts, error, ms: performance.now() - t0,
      hands: h ? h.landmarks.map(l => l.map(q => [q.x, q.y, q.z])) : [],
      handed: h ? h.handedness.map(x => x[0].categoryName) : [],
      pose: p?.landmarks?.[0] ? p.landmarks[0].map(q => [q.x, q.y, q.z, q.visibility ?? 1]) : null,
    });
  }
};
