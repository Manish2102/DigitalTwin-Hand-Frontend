# Object to 3D

Show an object to the laptop webcam (or upload a photo). Two AI models run in the browser: one cuts the
object out of the picture, the other estimates how far away every pixel is. The page turns that depth into
a solid 3D model coloured with the photo. You can rotate it, export it, and keep it in a library.

This section uses the **laptop's own webcam**, not the phone. It does not use the backend at all, and the
photo never leaves the browser.

Files: [`js/scan.js`](../js/scan.js) (the screen and the flow) and [`js/scan/`](../js/scan) (the pieces).

## What it is, and is not

| It is | It is not |
|---|---|
| A textured 3D **relief**: it looks 3D from the front and up to about 60° either side | A full 360° scan. The back is flat and the sides are guessed |
| A **snapshot twin**: a stored virtual copy of how an object looked at one moment | A live twin like the hand and parcel twins; it does not update |
| Built from **estimated** depth | A measurement. Depth is relative, so a real size only comes from the width you enter |

## The flow

```
 webcam / file ──► photo ──┬─► depth model (worker) ───────────────┐
 (camera.js)               │   depth.js, depth.worker.js            ├─► mask + depth ─► mesh.js ─► viewer.js ─► export
                           └─► click the object ─► segment.js ──────┘   (cropped, smoothed,         (Three.js)   GLB / STL
                               "cut-out" mask                           solid mesh)                              library
```

1. **Capture.** *Start camera*, then *Capture* (a 3 second countdown so you can hold the object still). Or
   *Upload photo* (for example one taken with a phone). Photos are shrunk to 1024 px on the long side. The
   preview and the capture are **not mirrored**, so text on objects reads correctly. With several cameras a
   picker appears. The camera is switched off after the capture and whenever you leave the section.
2. **Depth starts immediately**, in a Web Worker, while you choose the object. The two steps run in parallel.
3. **Select the object.** Click it in the photo. A mask (blue tint) shows what was selected; click another spot
   to change it. *Use the whole picture* skips the cut-out.
4. **Build.** When both the mask and the depth exist, the mesh is built and the **3D model** tab opens.
   The three sliders rebuild it live.

## The models

| Job | Model | Size | Runs on |
|---|---|---|---|
| Cut out the object | MediaPipe Interactive Image Segmenter, "magic touch" v2 (Apache-2.0), through `@mediapipe/tasks-vision` 1.2.0 | about 30 MB | CPU, in the page |
| Estimate depth | Depth Anything V2 Small (Apache-2.0), through Transformers.js 3.8.1 | 49.6 MB half precision on WebGPU, 27.3 MB 8-bit on WASM | WebGPU when the browser has it, otherwise CPU, in a Web Worker |

Both download the first time the section is used. The depth model is stored by Transformers.js in the
browser's cache.

Choices worth knowing:

- **The segmenter runs on CPU on purpose.** With the GPU delegate it returned an empty mask in testing, and
  one click is fast enough on CPU.
- **WebGPU fallback.** `depth.worker.js` tries WebGPU with the half-precision model, and if that fails for any
  reason (no adapter, no half-float support) it falls back to the 8-bit model on WASM. The step shows which
  one was used ("GPU" or "CPU") and how long it took.
- **Depth is relative.** The model returns "bigger = nearer" with no unit. `scan.js` checks the direction
  (an object held up to a camera is nearer than what is behind it) and flips the values if the model says the
  opposite. `normalizeDepth` then stretches the depth of the *selected area* to 0..1, ignoring the 2 % extremes,
  so any object uses the full relief range.

## The mesh ([`mesh.js`](../js/scan/mesh.js))

Pure functions with no DOM and no Three.js, so they are unit-tested in Node.

| Function | What it does |
|---|---|
| `resample` | Bilinear resize of a single-channel image (depth and mask are resized to the mesh grid, 360 cells across the picture) |
| `refineMask` | Blurs the soft mask once and thresholds it: removes speckles and ragged edges |
| `normalizeDepth` | Rescales depth inside the mask to 0..1 (2nd to 98th percentile) |
| `smoothDepth` | Blurs depth using only masked neighbours, so the background never bleeds into the object |
| `buildRelief` | Builds the solid mesh, described below |

`buildRelief`:

1. **Crops to the object's bounding box.** The box is 1 unit wide, so *Real width* means the object's width, and
   the viewer frames the object, not the whole photo. UVs still point into the full picture, so the photo is the
   texture without cropping.
2. **Front surface**, triangle by triangle: z = depth × *strength* (a fraction of the object's width). A triangle is
   kept when its three corners are on the object and the depth does not jump by more than 0.22 (which stops
   long stretched sheets at depth edges). Each quad is split along whichever diagonal keeps more of it, which
   halves the stair-stepping along the outline.
3. **Back face**: the same triangles, reversed, flat at z = −*thickness*.
4. **Side walls**: every edge of the front surface whose opposite edge is missing lies on the silhouette, and gets
   a wall down to the back. This makes the mesh **watertight**, which 3D printing needs.

Tested in `Node` with a synthetic dome: no open edges, no duplicate edges, outward-facing triangles (positive
volume), correct z range, cropped to the object, and `null` for an empty mask.

## The viewer ([`viewer.js`](../js/scan/viewer.js))

Three.js 0.170.0, loaded only when a model is first shown, through the import map in `index.html`.

- Orbit controls, with the horizontal range limited to about 60° each way by default (a relief looks wrong from
  the side or back). *Rotate all the way round* removes the limit.
- The camera distance is fitted to the object's shape and the window, and refitted when the window changes.
- A light that follows the camera keeps the shading readable. Turning *Shaded* off shows the plain photo.
- It does not render while its tab or section is hidden.

## Export

| Format | Content | Units |
|---|---|---|
| **GLB** (binary glTF) | Mesh with the photo as its colour texture | Metres, from *Real width* |
| **STL** | Solid shape for 3D printing, no colour | Millimetres, from *Real width* |

*Real width* is the object's real width in cm. If it is empty, the export assumes 10 cm and says so. The exported
mesh is a scaled copy, so the sliders and the view are unaffected.

## Library

Scans are saved in the browser's IndexedDB (`dtl-scans`). A saved scan keeps the photo (JPEG), the **raw depth**,
the mask, the slider values, the real width, the name and a thumbnail. Re-opening it rebuilds the mesh without
running either model again, so you can still re-tune or export it. Nothing is uploaded. If the browser blocks
storage (private mode), the library card says saving is unavailable and the rest keeps working.

## Performance

Measured while building this, in headless Chrome and a desktop browser:

| Step | Result |
|---|---|
| Depth on WebGPU | about 3 s for an 800 × 600 photo (after the model downloaded) |
| Depth on CPU (WASM) | 17 to 87 s in headless Chrome, depending on load; the step warns it can take up to a minute |
| Select the object | a few seconds the first time (it loads the segmenter), faster afterwards |
| Mesh | about 50 000 triangles for an object covering 13 % of the picture; rebuilds as you drag a slider |

## Limits

- Shiny, see-through and furry objects give poor depth. Plain, matte, textured objects in good light work best.
- Only the front is real. Hollow parts (the inside of a mug) are not modelled.
- Depth steps can show as faint rings on smooth surfaces, more so on the CPU model; *Smoothness* reduces them.
- A very small selection (under 1 % of the picture) is rejected.
- Browser support: the camera needs HTTPS or `localhost`; WebGPU is Chrome and Edge (other browsers use the CPU path).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Camera permission was blocked" | The browser blocked the camera | Allow it in the address bar, or use *Upload photo* |
| Depth step stays "Downloading" | Slow connection (up to about 80 MB on first use) | Wait; later uses are faster |
| "Nothing found there" | The click was on a part the segmenter did not treat as an object | Click the middle of the object, or *Use the whole picture* |
| Model looks like a flat blob | Weak depth for that object, or *Depth strength* too low | Raise *Depth strength*; try better light |
| Jagged or striped sides | Depth edges are steep | Raise *Smoothness*, lower *Depth strength* |
| Models fail to load | A CDN is blocked (`cdn.jsdelivr.net`, `huggingface.co`, `storage.googleapis.com`) | Allow them; see [deployment.md](deployment.md#external-resources) |

## Adding to it

- A different depth model: change `MODEL` and the `dtype` choices in `js/scan/depth.worker.js`. Keep the contract
  that `data` is "bigger = nearer" at `w × h`.
- A different export: add a function to `viewer.js` (see `exportGLB`) and a toolbar button in `index.html`.
- Tuning constants: `GRID_W` (mesh resolution) in `scan.js`; `maxJump`, `pad`, and the slider ranges in `buildRelief` and `index.html`.
