// vision.js - the laptop camera plus hand / pose tracking in a worker, shared by GestureDeck and Sign language.
//
//   const v = new Vision({ pose: true });
//   v.onResult(r => ...);            // r: { hands, handed, pose, ts, ms }  (hands mirrored? no: raw camera coordinates)
//   await v.start(videoElement);      // asks for the camera, loads the models, starts tracking
//   v.stop();                         // camera off (the models stay loaded for a quick restart)
//
// Frames are captured with createImageBitmap and sent to the worker one at a time: if the worker is still busy, the
// newest frame waits and older ones are dropped, so tracking never builds up a delay and the page never blocks.

export class Vision {
  constructor({ hands = true, pose = false, numHands = 2 } = {}) {
    this.opts = { hands, pose, numHands };
    this.state = "off";                 // off | starting | on | error
    this.message = "";
    this.fps = 0; this.ms = 0; this.delegate = "";
    this._cbs = []; this._stateCbs = [];
    this._worker = null; this._ready = null; this._stream = null; this._video = null;
    this._busy = false; this._raf = 0; this._frames = 0; this._fpsT = 0; this._lastT = -1; this._sent = 0;
  }
  onResult(fn) { this._cbs.push(fn); }
  onState(fn) { this._stateCbs.push(fn); }
  _set(state, message = "") { this.state = state; this.message = message; this._stateCbs.forEach(f => f(state, message)); }

  _initWorker() {
    if (this._ready) return this._ready;
    this._worker = new Worker(new URL("./vision.worker.js", import.meta.url), { type: "module" });
    this._ready = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("The hand model took too long to load. Check the internet connection.")), 60000);
      this._worker.onmessage = e => {
        const m = e.data;
        if (m.type === "ready") { clearTimeout(t); this.delegate = m.delegate; resolve(); }
        else if (m.type === "error") { clearTimeout(t); reject(new Error(m.message)); }
        else if (m.type === "result") this._onResult(m);
      };
      this._worker.onerror = e => { clearTimeout(t); reject(new Error(e.message || "The tracking worker failed to start")); };
    });
    this._worker.postMessage({ type: "init", ...this.opts });
    this._ready.catch(() => { this._worker?.terminate(); this._worker = null; this._ready = null; });
    return this._ready;
  }

  async start(video, { deviceId } = {}) {
    if (this.state === "on" || this.state === "starting") return this.state === "on";
    this._video = video;
    if (!navigator.mediaDevices?.getUserMedia) {
      this._set("error", "The camera needs a secure page (https or localhost)."); return false;
    }
    this._set("starting", "Asking for the camera...");
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({ audio: false,
        video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
                        : { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } });
    } catch (e) {
      this._set("error", cameraError(e)); return false;
    }
    video.muted = true; video.playsInline = true; video.srcObject = this._stream;
    try { await video.play(); } catch {}
    // the camera can be unplugged or taken by another app while running
    this._stream.getVideoTracks()[0]?.addEventListener("ended", () => { this.stop(); this._set("error", "The camera stopped (unplugged or taken by another app)."); });
    this._set("starting", "Loading the hand model (about 8 MB the first time)...");
    try { await this._initWorker(); }
    catch (e) { this._stopTracks(); this._set("error", e.message); return false; }
    if (!this._stream) return false;                         // stopped while loading
    this._busy = false; this._frames = 0; this._fpsT = performance.now(); this._lastT = -1;
    this._set("on");
    this._loop();
    return true;
  }

  _loop = async () => {
    if (this.state !== "on") return;
    this._raf = requestAnimationFrame(this._loop);
    const v = this._video;
    // a lost worker reply must not stop tracking for good
    if (this._busy && performance.now() - this._sent > 2000) this._busy = false;
    if (this._busy || !v || v.readyState < 2 || v.currentTime === this._lastT) return;
    this._lastT = v.currentTime; this._busy = true; this._sent = performance.now();
    try {
      const bitmap = await createImageBitmap(v);
      this._worker.postMessage({ type: "frame", bitmap, ts: performance.now() }, [bitmap]);
    } catch { this._busy = false; }
  };

  _onResult(m) {
    this._busy = false;
    if (this.state !== "on") return;
    this.ms = m.ms; this._frames++;
    const now = performance.now();
    if (now - this._fpsT >= 1000) { this.fps = Math.round(this._frames * 1000 / (now - this._fpsT)); this._frames = 0; this._fpsT = now; }
    const aspect = (this._video.videoWidth || 4) / (this._video.videoHeight || 3);
    const r = { ts: m.ts, hands: m.hands, handed: m.handed, pose: m.pose, ms: m.ms, aspect, error: m.error };
    for (const f of this._cbs) { try { f(r); } catch (e) { console.error(e); } }
  }

  _stopTracks() {
    this._stream?.getTracks().forEach(t => t.stop()); this._stream = null;
    if (this._video) this._video.srcObject = null;
  }
  stop() {
    if (this.state === "off") return;
    cancelAnimationFrame(this._raf);
    this._stopTracks();
    this._busy = false;
    this._set("off");
  }
}

export function cameraError(e) {
  return e?.name === "NotAllowedError" ? "Camera blocked. Allow it in the address bar (camera icon), then try again."
       : e?.name === "NotFoundError" ? "No camera found on this computer."
       : e?.name === "NotReadableError" ? "The camera is busy in another app or tab. Close it and try again."
       : e?.name === "OverconstrainedError" ? "That camera is not available any more. Pick another one."
       : `Could not start the camera (${e?.name ?? "unknown error"}).`;
}

export async function listCameras() {
  try { return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput"); } catch { return []; }
}

// MediaPipe's 21 hand points, connected
export const HAND_BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
                           [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
