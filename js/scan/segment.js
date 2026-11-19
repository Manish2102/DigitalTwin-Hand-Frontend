// segment.js - click an object to cut it out. MediaPipe's Interactive Image Segmenter (Apache-2.0)
// takes one point and returns a mask of the object under it. It runs in the page.

const VISION = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0";
const MODEL = "https://storage.googleapis.com/mediapipe-models/interactive_segmenter_v2/magic_touch/int8/latest/interactive_segmentation.task";

let ready = null;

function load() {
  ready ??= (async () => {
    const { FilesetResolver, InteractiveSegmenter } = await import(`${VISION}/vision_bundle.mjs`);
    const fileset = await FilesetResolver.forVisionTasks(`${VISION}/wasm`);
    // CPU on purpose: with the GPU delegate this model returned an empty mask in testing, and a single click is fast enough on CPU.
    return InteractiveSegmenter.createFromOptions(fileset, { baseOptions: { modelAssetPath: MODEL, delegate: "CPU" } });
  })().catch(e => { ready = null; throw e; });
  return ready;
}
export const preloadSegmenter = () => load().catch(() => {});

/** nx, ny: the click position as fractions of the picture (0..1). Returns { w, h, mask: Float32Array }. */
export async function segmentAt(canvas, nx, ny) {
  const seg = await load();
  seg.setImage(canvas);
  const result = seg.segment([{ brushMode: 1, point: [{ x: nx, y: ny }], isCompleted: true }]);
  const mask = Float32Array.from(result.getAsFloat32Array());
  const out = { w: result.width, h: result.height, mask };
  result.close?.();
  return out;
}
