// depth.worker.js - runs the depth model off the main thread so the page stays responsive.
// Model: Depth Anything V2 Small (Apache-2.0) through Transformers.js. It estimates RELATIVE depth
// from one photo (bigger value = closer); it does not measure real distances.
import { pipeline, RawImage, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

env.allowLocalModels = false;
const MODEL = "onnx-community/depth-anything-v2-small";
let estimator = null, device = null, loading = null;

const say = msg => postMessage(msg);

function load() {
  loading ??= (async () => {
    // WebGPU with half-precision weights when the browser has it; otherwise the smaller 8-bit build on WASM.
    const tries = (self.navigator?.gpu ? [{ device: "webgpu", dtype: "fp16" }] : []).concat([{ device: "wasm", dtype: "q8" }]);
    let lastError;
    for (const t of tries) {
      try {
        say({ type: "status", text: `Loading depth model (${t.device})` });
        estimator = await pipeline("depth-estimation", MODEL, {
          ...t,
          progress_callback: p => { if (p.status === "progress") say({ type: "progress", file: p.file, loaded: p.loaded, total: p.total, progress: p.progress }); },
        });
        device = t.device;
        return;
      } catch (e) { lastError = e; say({ type: "status", text: `${t.device} failed (${e.message}); trying the next option` }); }
    }
    loading = null;
    throw lastError;
  })();
  return loading;
}

onmessage = async ({ data }) => {
  const { id, blob } = data;
  try {
    await load();
    say({ type: "status", text: device === "wasm" ? "Estimating depth on the CPU (can take up to a minute)" : "Estimating depth" });
    const t0 = performance.now();
    const out = await estimator(await RawImage.fromBlob(blob));
    const t = out.predicted_depth, dims = t.dims;
    const h = dims[dims.length - 2], w = dims[dims.length - 1];
    const arr = Float32Array.from(t.data);
    postMessage({ type: "result", id, w, h, data: arr, device, ms: Math.round(performance.now() - t0) }, [arr.buffer]);
  } catch (e) {
    postMessage({ type: "error", id, message: e?.message || String(e) });
  }
};
