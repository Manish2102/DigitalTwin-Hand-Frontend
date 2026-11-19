// scan.js - the "Object to 3D" section: webcam (or uploaded) photo -> cut-out -> depth AI -> 3D relief.
// The models and Three.js load only when this section is used. Nothing here talks to the backend,
// and the photo never leaves the browser.

import { $, on } from "./core.js";
import { icon, hydrateIcons, setButton } from "./icons.js";
import { toast } from "./ui.js";
import { listCameras, startCamera, stopCamera, cameraOn, captureFrame, loadImageFile, canvasToBlob } from "./scan/camera.js";
import { estimateDepth, setProgressListener } from "./scan/depth.js";
import { segmentAt, preloadSegmenter } from "./scan/segment.js";
import { resample, refineMask, normalizeDepth, smoothDepth, buildRelief } from "./scan/mesh.js";
import * as viewer from "./scan/viewer.js";
import { saveScan, getScan, deleteScan, listScans, newId } from "./scan/library.js";

const GRID_W = 360;                      // mesh resolution across the whole picture (the model is cropped to the object)
const S = {
  photo: null,                           // canvas with the captured picture
  depth: null,                           // { w, h, data, device, ms } raw relative depth from the model
  mask: null,                            // { w, h, data: Float32Array 0..1 } selection from the segmenter
  whole: false,
  grid: null,                            // { gw, gh, maskU8, norm } prepared for meshing
  model: false,
  token: 0,                              // bumped for every new photo so late results from an old one are ignored
  deviceId: null,
};

const photoC = $("scPhoto"), depthC = $("scDepth"), video = $("scVideo");
const STEP_ICON = { idle: "clock", active: "rotateCw", wait: "crosshair", done: "checkCircle", error: "alert" };

// ------------------------------------------------------------------ steps
function setStep(n, state, sub) {
  const li = document.querySelector(`#scSteps li[data-step="${n}"]`);
  li.dataset.state = state;
  li.querySelector(".sc-ico").innerHTML = icon(STEP_ICON[state] ?? "clock", 14);
  if (sub != null) li.querySelector(".sc-sub").textContent = sub;
}
const STEP_DEFAULT = ["Camera or upload", "Click it in the photo", "AI model, runs in this browser", "Depth becomes a solid mesh"];
function resetSteps() {
  for (let n = 1; n <= 4; n++) setStep(n, "idle", STEP_DEFAULT[n - 1]);
  progress(null);
}
function progress(pct) {
  $("scProgWrap").classList.toggle("on", pct != null);
  $("scProg").style.width = `${pct ?? 0}%`;
}
const banner = text => { $("scBanner").textContent = text; };

// -------------------------------------------------------------- tabs / view
let tab = "photo";
function setTab(name) {
  if (name === "model" && !S.model) return;
  if (name === "depth" && !S.grid) return;
  tab = name;
  document.querySelectorAll("#scTabs button").forEach(b => b.classList.toggle("sel", b.dataset.tab === name));
  refreshStage();
}
function refreshStage() {
  const live = cameraOn() && !S.photo;
  const showPhoto = tab === "photo" && !!S.photo;
  $("scVideo").classList.toggle("off", !(tab === "photo" && live));
  photoC.classList.toggle("off", !showPhoto);
  depthC.classList.toggle("off", tab !== "depth");
  $("scView").classList.toggle("off", tab !== "model");
  $("scEmpty").classList.toggle("hidden", live || !!S.photo);
  $("scReset").disabled = tab !== "model";
  const hasModel = S.model, hasGrid = !!S.grid;
  document.querySelector('#scTabs [data-tab="model"]').disabled = !hasModel;
  document.querySelector('#scTabs [data-tab="depth"]').disabled = !hasGrid;
  for (const id of ["scGlb", "scStl", "scSave"]) $(id).disabled = !hasModel;
  $("scRetake").disabled = !S.photo && !cameraOn();
  $("scWhole").disabled = !S.photo || S.whole;
  if (tab === "photo") banner(S.photo ? (S.mask ? "Click another spot to change the selection" : "Click the object you want to scan") : (live ? "Hold the object up, then press Capture" : ""));
  else if (tab === "model") banner("Drag to rotate, scroll to zoom");
  else banner("Lighter is nearer, darker is farther. Outside the object is dimmed.");
}

// -------------------------------------------------------------------- photo
function drawPhoto() {
  const c = photoC;
  c.width = S.photo.width; c.height = S.photo.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(S.photo, 0, 0);
  if (!S.mask) return;
  const { w, h, data } = S.mask;
  const img = new ImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const on = data[i] > 0.5;
    img.data[i * 4] = 123; img.data[i * 4 + 1] = 150; img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = on ? 105 : 0;
  }
  const t = document.createElement("canvas");
  t.width = w; t.height = h;
  t.getContext("2d").putImageData(img, 0, 0);
  ctx.drawImage(t, 0, 0, c.width, c.height);
}

async function setPhoto(canvas) {
  const token = ++S.token;
  Object.assign(S, { photo: canvas, depth: null, mask: null, whole: false, grid: null, model: false });
  resetSteps();
  setStep(1, "done", `${canvas.width} × ${canvas.height} px`);
  setStep(2, "wait", "Click the object in the photo");
  drawPhoto();
  stopCamera(video);
  viewerClear();
  setTab("photo");
  preloadSegmenter();

  // depth starts right away and runs while the user picks the object
  setStep(3, "active", "Starting");
  try {
    const d = await estimateDepth(canvas);
    if (token !== S.token) return;
    S.depth = d;
    setStep(3, "done", `${d.device === "webgpu" ? "GPU" : "CPU"} · ${(d.ms / 1000).toFixed(1)} s`);
    progress(null);
    maybeBuild();
  } catch (e) {
    if (token !== S.token) return;
    setStep(3, "error", e.message.slice(0, 120));
    progress(null);
    toast("Depth estimation failed: " + e.message, "danger", 6000);
  }
}

setProgressListener(p => {
  if (p.type === "progress") {
    if (/\.onnx$/.test(p.file)) { progress(p.progress); setStep(3, "active", `Downloading the depth model ${Math.round(p.progress)}%`); }
  } else if (p.type === "status") { setStep(3, "active", p.text); if (!/^Loading/.test(p.text)) progress(null); }
});

// ---------------------------------------------------------------- selection
async function pick(nx, ny) {
  if (!S.photo) return;
  const token = S.token;
  setStep(2, "active", "Cutting out the object");
  try {
    const r = await segmentAt(S.photo, nx, ny);
    if (token !== S.token) return;
    S.mask = { w: r.w, h: r.h, data: r.mask };
    S.whole = false;
    S.focusModel = true;
    drawPhoto();
    const share = r.mask.reduce((n, v) => n + (v > 0.5 ? 1 : 0), 0) / r.mask.length;
    if (share < 0.01) { S.mask = null; drawPhoto(); setStep(2, "error", "Nothing found there. Click on the object."); refreshStage(); return; }
    setStep(2, "done", `${Math.round(share * 100)}% of the picture selected`);
    maybeBuild();
  } catch (e) {
    if (token !== S.token) return;
    setStep(2, "error", e.message.slice(0, 100));
    toast("Could not cut out the object: " + e.message + ". You can use the whole picture instead.", "danger", 6000);
  }
  refreshStage();
}
photoC.addEventListener("click", e => {
  const r = photoC.getBoundingClientRect();
  pick((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
});
photoC.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(0.5, 0.5); } });

$("scWhole").onclick = () => {
  if (!S.photo) return;
  S.mask = { w: 64, h: Math.max(8, Math.round(64 * S.photo.height / S.photo.width)), data: null };
  S.mask.data = new Float32Array(S.mask.w * S.mask.h).fill(1);
  S.whole = true;
  S.focusModel = true;
  drawPhoto();
  setStep(2, "done", "Whole picture");
  maybeBuild();
  refreshStage();
};

// -------------------------------------------------------------- build model
function maybeBuild() {
  if (!S.depth || !S.mask) return;
  const gw = GRID_W, gh = Math.max(8, Math.round(gw * S.photo.height / S.photo.width));
  setStep(4, "active", "Building");
  const maskU8 = refineMask(resample(S.mask.data, S.mask.w, S.mask.h, gw, gh), gw, gh);
  let area = 0; for (const v of maskU8) area += v;
  if (area < gw * gh * 0.01) { setStep(4, "error", "The selection is too small"); return; }

  let d = resample(S.depth.data, S.depth.w, S.depth.h, gw, gh);
  if (!S.whole) {
    // an object held up to the camera is nearer than what is behind it; if the model says the opposite, flip it
    let inSum = 0, inN = 0, outSum = 0, outN = 0, max = -Infinity;
    for (let i = 0; i < d.length; i++) { max = Math.max(max, d[i]); if (maskU8[i]) { inSum += d[i]; inN++; } else { outSum += d[i]; outN++; } }
    if (outN > gw * gh * 0.05 && inSum / inN < outSum / outN) d = d.map(v => max - v);
  }
  S.grid = { gw, gh, maskU8, norm: normalizeDepth(d, maskU8) };
  drawDepth();
  rebuild();
}

function drawDepth() {
  const { gw, gh, maskU8, norm } = S.grid;
  const img = new ImageData(gw, gh);
  for (let i = 0; i < gw * gh; i++) {
    const v = Math.round(255 * norm[i]) * (maskU8[i] ? 1 : 0.18);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  const t = document.createElement("canvas");
  t.width = gw; t.height = gh;
  t.getContext("2d").putImageData(img, 0, 0);
  depthC.width = S.photo.width; depthC.height = S.photo.height;
  const ctx = depthC.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(t, 0, 0, depthC.width, depthC.height);
}

let rebuildQueued = false;
function rebuild() {
  if (rebuildQueued) return;
  rebuildQueued = true;
  setTimeout(async () => {          // a timer, not requestAnimationFrame: frames do not fire while the tab is in the background
    rebuildQueued = false;
    if (!S.grid) return;
    try {
      const { gw, gh, maskU8, norm } = S.grid;
      const smooth = +$("scSmooth").value;
      const relief = buildRelief(smoothDepth(norm, maskU8, gw, gh, smooth), maskU8, gw, gh, {
        strength: +$("scStrength").value / 100,
        thickness: +$("scThick").value / 100,
        maxJump: 0.22,
      });
      if (!relief) { setStep(4, "error", "The selection is empty"); return; }
      await viewer.initViewer($("scView"));
      viewer.setOptions({ lit: $("scLit").checked, wireframe: $("scWire").checked, free: $("scFree").checked });
      viewer.setModel(relief, S.photo);
      const first = !S.model;
      S.model = true;
      setStep(4, "done", `${relief.triangles.toLocaleString()} triangles`);
      $("scStats").textContent = `${relief.triangles.toLocaleString()} triangles`;
      if (first || S.focusModel) setTab("model"); else refreshStage();
      S.focusModel = false;
    } catch (e) {
      setStep(4, "error", e.message.slice(0, 100));
      toast("Could not show the 3D model: " + e.message, "danger", 6000);
    }
  }, 30);
}

function viewerClear() {
  $("scStats").textContent = "";
  $("scName").value = "";
}

for (const [id, out, fmt] of [["scStrength", "scStrengthV", v => v + "%"], ["scSmooth", "scSmoothV", v => v], ["scThick", "scThickV", v => v + "%"]]) {
  $(id).addEventListener("input", () => { $(out).textContent = fmt($(id).value); rebuild(); });
}
for (const id of ["scLit", "scWire", "scFree"]) {
  $(id).addEventListener("change", () => viewer.setOptions({ lit: $("scLit").checked, wireframe: $("scWire").checked, free: $("scFree").checked }));
}
$("scReset").onclick = () => viewer.resetView();
document.querySelectorAll("#scTabs button").forEach(b => b.onclick = () => setTab(b.dataset.tab));

// ------------------------------------------------------------------ camera
async function fillCameras() {
  try {
    const cams = await listCameras();
    const sel = $("scCam");
    sel.innerHTML = cams.map(c => `<option value="${c.id}">${c.label.replace(/[<&]/g, "")}</option>`).join("");
    if (S.deviceId) sel.value = S.deviceId;
    sel.style.display = cams.length > 1 ? "" : "none";
  } catch {}
}
function clearPhoto() {
  S.token++;
  Object.assign(S, { photo: null, depth: null, mask: null, grid: null, model: false, whole: false, focusModel: false });
  resetSteps();
  viewerClear();
  tab = "photo";
  document.querySelectorAll("#scTabs button").forEach(b => b.classList.toggle("sel", b.dataset.tab === "photo"));
}
let usedCamera = false;
async function openCamera() {
  if (S.photo) clearPhoto();
  const btn = $("scMain");
  btn.disabled = true;
  setButton(btn, "camera", "Starting…");
  try {
    await startCamera(video, S.deviceId);
    await fillCameras();
    S.deviceId = $("scCam").value || null;
    usedCamera = true;
    $("scDevice").textContent = "Camera on";
    setButton(btn, "camera", "Capture");
    btn.dataset.tip = "Take the photo after a 3 second countdown";
  } catch (e) {
    setButton(btn, "camera", "Start camera");
    toast(e.name === "NotAllowedError" ? "Camera permission was blocked. Allow it in the address bar, or upload a photo." : "Could not open the camera: " + e.message, "danger", 6000);
  }
  btn.disabled = false;
  refreshStage();
}
let counting = false;
async function countdownAndCapture() {
  if (counting) return;
  counting = true;
  const btn = $("scMain");
  btn.disabled = true;
  for (let n = 3; n >= 1; n--) { setButton(btn, "clock", `Capturing in ${n}`); banner(`Hold still: ${n}`); await new Promise(r => setTimeout(r, 1000)); if (!cameraOn()) break; }
  counting = false;
  btn.disabled = false;
  if (!cameraOn()) { setButton(btn, "camera", "Start camera"); return; }
  const frame = captureFrame(video);
  setButton(btn, "camera", "Start camera");
  btn.dataset.tip = "Turn on the laptop webcam";
  $("scDevice").textContent = "";
  setPhoto(frame);
}
$("scMain").onclick = () => (cameraOn() && !S.photo ? countdownAndCapture() : openCamera());
$("scCam").onchange = async () => { S.deviceId = $("scCam").value; if (cameraOn()) await openCamera(); };
$("scUpload").onclick = () => $("scFile").click();
$("scFile").onchange = async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try { await setPhoto(await loadImageFile(f)); }
  catch (err) { toast("Could not read that picture: " + err.message, "danger"); }
};
$("scRetake").onclick = () => {
  clearPhoto();
  setButton($("scMain"), "camera", "Start camera");
  if (usedCamera) openCamera(); else refreshStage();
};

// the camera is only on while this section is open
on("section", name => {
  if (name === "scan") return;
  if (cameraOn()) { stopCamera(video); counting = false; setButton($("scMain"), "camera", "Start camera"); $("scDevice").textContent = ""; refreshStage(); }
});

// ------------------------------------------------------------------ export
const baseName = () => ($("scName").value.trim() || "scan").replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-").toLowerCase() || "scan";
function widthCm() {
  const v = parseFloat($("scWidth").value);
  if (v > 0) return v;
  toast("No real width entered, so the model is exported as 10 cm wide.", "info", 4000);
  return 10;
}
function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
$("scGlb").onclick = async () => {
  try { download(await viewer.exportGLB(widthCm()), `${baseName()}.glb`); toast("GLB downloaded", "success"); }
  catch (e) { toast("GLB export failed: " + e.message, "danger"); }
};
$("scStl").onclick = async () => {
  try { download(await viewer.exportSTL(widthCm()), `${baseName()}.stl`); toast("STL downloaded (millimetres)", "success"); }
  catch (e) { toast("STL export failed: " + e.message, "danger"); }
};

// ----------------------------------------------------------------- library
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
async function renderLibrary() {
  let items = [];
  try { items = await listScans(); } catch { $("scLib").innerHTML = `<div class="empty"><span class="empty-desc">Saving is not available in this browser mode.</span></div>`; return; }
  $("scLibMeta").textContent = items.length ? `${items.length} saved` : "";
  $("scLib").innerHTML = items.length ? items.map(s => `
      <div class="sc-item" data-id="${s.id}">
        <button class="open" aria-label="Open ${esc(s.name)}"><img alt="" src="${s.thumb}"><div class="nm">${esc(s.name)}<small>${new Date(s.created).toLocaleDateString()}</small></div></button>
        <button class="del" aria-label="Delete ${esc(s.name)}" data-tip="Delete">${icon("trash", 14)}</button>
      </div>`).join("")
    : `<div class="empty"><span class="empty-title">No saved scans</span><span class="empty-desc">Scans you save appear here, kept in this browser only.</span></div>`;
}
$("scLib").addEventListener("click", async e => {
  const item = e.target.closest(".sc-item");
  if (!item) return;
  const id = item.dataset.id;
  if (e.target.closest(".del")) { await deleteScan(id).catch(() => {}); renderLibrary(); return; }
  openSaved(id);
});

$("scSave").onclick = async () => {
  if (!S.model) return;
  try {
    setTab("model");
    await new Promise(r => setTimeout(r, 120));
    const name = $("scName").value.trim() || `Scan ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    const m = S.mask;
    await saveScan({
      id: newId(), name, created: Date.now(),
      photo: await canvasToBlob(S.photo),
      depth: { w: S.depth.w, h: S.depth.h, data: S.depth.data, device: S.depth.device },
      mask: { w: m.w, h: m.h, data: Uint8Array.from(m.data, v => Math.round(v * 255)) },
      whole: S.whole,
      settings: { strength: +$("scStrength").value, smooth: +$("scSmooth").value, thick: +$("scThick").value, width: $("scWidth").value },
      thumb: viewer.snapshot(),
    });
    toast(`Saved "${name}" to this browser`, "success");
    renderLibrary();
  } catch (e) { toast("Could not save: " + e.message, "danger"); }
};

async function openSaved(id) {
  try {
    const s = await getScan(id);
    if (!s) return;
    stopCamera(video);
    const bmp = await createImageBitmap(s.photo);
    const c = document.createElement("canvas");
    c.width = bmp.width; c.height = bmp.height;
    c.getContext("2d").drawImage(bmp, 0, 0);
    bmp.close();
    ++S.token;
    resetSteps();
    Object.assign(S, { photo: c, depth: s.depth, mask: { w: s.mask.w, h: s.mask.h, data: Float32Array.from(s.mask.data, v => v / 255) }, whole: !!s.whole, grid: null, model: false });
    setStep(1, "done", "From the library"); setStep(2, "done", s.whole ? "Whole picture" : "Saved selection"); setStep(3, "done", "Saved depth");
    for (const [k, id2, out, f] of [["strength", "scStrength", "scStrengthV", v => v + "%"], ["smooth", "scSmooth", "scSmoothV", v => v], ["thick", "scThick", "scThickV", v => v + "%"]]) {
      $(id2).value = s.settings[k]; $(out).textContent = f(s.settings[k]);
    }
    $("scWidth").value = s.settings.width || "";
    $("scName").value = s.name;
    drawPhoto();
    maybeBuild();
    toast(`Opened "${s.name}"`, "info");
  } catch (e) { toast("Could not open that scan: " + e.message, "danger"); }
}

// -------------------------------------------------------------------- start
hydrateIcons($("sec-scan"));
resetSteps();
refreshStage();
renderLibrary();

// handles for testing and for other modules
window.__scan = { S, setPhoto, pick, loadImageFile };
