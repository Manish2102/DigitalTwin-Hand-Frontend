// depth.js - main-thread side of the depth worker.
import { canvasToBlob } from "./camera.js";

let worker = null, nextId = 1, onProgress = () => {};
const waiting = new Map();

export function setProgressListener(fn) { onProgress = fn; }

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./depth.worker.js", import.meta.url), { type: "module" });
  worker.onmessage = ({ data }) => {
    if (data.type === "result" || data.type === "error") {
      const w = waiting.get(data.id);
      waiting.delete(data.id);
      if (!w) return;
      data.type === "result" ? w.resolve(data) : w.reject(new Error(data.message));
    } else onProgress(data);
  };
  worker.onerror = e => {
    for (const w of waiting.values()) w.reject(new Error(e.message || "the depth worker failed to start"));
    waiting.clear(); worker = null;
  };
  return worker;
}

/** Resolves with { w, h, data: Float32Array (bigger = nearer), device, ms }. */
export async function estimateDepth(canvas) {
  const blob = await canvasToBlob(canvas);
  const id = nextId++;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    ensureWorker().postMessage({ id, blob });
  });
}
