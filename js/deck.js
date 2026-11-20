// deck.js - GestureDeck: present your own PowerPoint or PDF in the browser and change slides with a hand swipe.
//
// Pieces: deck/render.js opens the file and draws slides; vision/vision.js runs the laptop camera and hand tracking
// in a worker; deck/swipe.js decides what counts as a swipe. This file is the screen: stage, toolbar, slide list,
// floating camera preview, full screen, keyboard and gesture navigation.
// Swipe right (to the presenter's right) = next slide, swipe left = previous. "Reverse" swaps them.

import { $, on, twin } from "./core.js";
import { icon, hydrateIcons } from "./icons.js";
import { toast } from "./ui.js";
import { openDeck, DeckError } from "./deck/render.js";
import { SwipeDetector } from "./deck/swipe.js";
import { Vision, HAND_BONES } from "./vision/vision.js";

const PREFS = "dtl.deck";
const prefs = (() => { try { return JSON.parse(localStorage.getItem(PREFS)) || {}; } catch { return {}; } })();
const savePrefs = () => { try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch {} };
prefs.corner ??= "br"; prefs.sens ??= "normal"; prefs.reverse ??= false; prefs.camVisible ??= true; prefs.camSize ??= "m";

let deck = null, cur = 0, front = $("dkSlideA"), back = $("dkSlideB"), showing = 0, loading = false;
let whyText = "", gestureWhyAt = 0, lastSeen = "", gesturesOn = false, black = false, startedAt = 0;
const detector = new SwipeDetector({ sensitivity: prefs.sens });
const vision = new Vision({ hands: true, pose: false, numHands: 2 });
const stats = { swipes: 0, last: "", lastAt: 0 };
window.__deck = { get deck() { return deck; }, get cur() { return cur; }, detector, vision, stats, go: n => go(n, "test") };   // for the console and tests

// ------------------------------------------------------------------ opening
$("dkOpen").onclick = $("dkEmptyOpen").onclick = () => $("dkFile").click();
$("dkFile").onchange = e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) load(f); };
const stage = $("dkStage");
stage.addEventListener("dragover", e => { e.preventDefault(); stage.classList.add("drag"); });
stage.addEventListener("dragleave", () => stage.classList.remove("drag"));
stage.addEventListener("drop", e => { e.preventDefault(); stage.classList.remove("drag"); const f = e.dataTransfer?.files?.[0]; if (f) load(f); });

export async function load(file) {
  if (loading) return;
  loading = true;
  $("dkError").classList.add("hidden");
  setLoading(0.02, `Opening ${file.name}...`);
  try {
    const d = await openDeck(file, setLoading);
    deck?.destroy();
    deck = d; cur = 0; startedAt = Date.now();
    $("dkName").textContent = d.name; $("dkName").title = d.name;
    $("dkEmpty").classList.add("hidden");
    renderWarnings(); await renderThumbs();
    await show(0, true);
    toast(`${d.count} slides ready`, "success");
  } catch (e) {
    console.warn("deck load failed", e);
    const err = e instanceof DeckError ? e : new DeckError("Something went wrong while opening this file.", String(e?.message ?? e));
    $("dkErrorText").textContent = err.message;
    $("dkErrorHint").textContent = err.hint ?? "";
    $("dkError").classList.remove("hidden");
    if (deck) toast(err.message, "warning", 5000);                 // the previous presentation stays open
    else $("dkEmpty").classList.remove("hidden");
  } finally {
    loading = false; setLoading(null);
  }
}

function setLoading(f, text = "") {
  $("dkLoading").classList.toggle("hidden", f == null);
  if (f != null) { $("dkLoadBar").style.width = `${Math.round(f * 100)}%`; $("dkLoadText").textContent = text; }
}

function renderWarnings() {
  const notes = [...deck.warnings];
  if (deck.kind === "pptx") notes.push("Animations, transitions, audio and video are not played: each slide shows its final state. For an exact copy of your slides, export to PDF in PowerPoint (File, Export, PDF) and open that.");
  else notes.push("PDF slides look exactly like the original. Animations are not part of a PDF.");
  $("dkNotes").innerHTML = notes.map(n => `<li>${esc(n)}</li>`).join("");
  $("dkKind").textContent = deck.kind === "pdf" ? "PDF" : "PowerPoint";
}

async function renderThumbs() {
  const list = $("dkThumbs");
  list.innerHTML = Array.from({ length: deck.count }, (_, i) =>
    `<button class="dk-thumb" data-i="${i}" aria-label="Slide ${i + 1}"><span class="dk-thumb-n">${i + 1}</span><span class="dk-thumb-img" style="aspect-ratio:${deck.aspect}"></span></button>`).join("");
  list.querySelectorAll(".dk-thumb").forEach(b => b.onclick = () => go(+b.dataset.i, "click"));
  const mine = deck;
  const io = new IntersectionObserver(entries => {                  // draw thumbnails only when they scroll into view
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      io.unobserve(en.target);
      const i = +en.target.dataset.i;
      mine.thumb(i).then(el => { if (deck === mine) en.target.querySelector(".dk-thumb-img").appendChild(el); }).catch(() => {});
    }
  }, { root: list.closest(".panel") ?? null, rootMargin: "300px" });
  list.querySelectorAll(".dk-thumb").forEach(b => io.observe(b));
}

// --------------------------------------------------------------- showing
function frameSize() {
  const r = stage.getBoundingClientRect();
  let w = r.width, h = w / deck.aspect;
  if (h > r.height) { h = r.height; w = h * deck.aspect; }
  return [Math.floor(w), Math.floor(h)];
}

async function show(i, instant = false) {
  if (!deck) return;
  const n = ++showing;
  const [w, h] = frameSize();
  let el;
  try { el = await deck.slide(i, w, h); }
  catch (e) { console.warn(e); toast(`Slide ${i + 1} could not be drawn`, "warning"); return; }
  if (n !== showing) return;                                         // a newer request won
  const frame = document.createElement("div");
  frame.className = "dk-frame";
  frame.style.width = `${w}px`; frame.style.height = `${h}px`;
  frame.appendChild(el);
  back.replaceChildren(frame);
  [front, back] = [back, front];
  front.classList.add("on"); back.classList.remove("on");
  if (instant) back.replaceChildren();
  else setTimeout(() => { if (!back.classList.contains("on")) back.replaceChildren(); }, 260);
  updateCounters();
}

function updateCounters() {
  const txt = deck ? `${cur + 1} / ${deck.count}` : "0 / 0";
  $("dkCount").textContent = txt; $("dkHudCount").textContent = txt;
  $("dkPrev").disabled = !deck || cur === 0; $("dkNext").disabled = !deck || cur >= deck.count - 1;
  document.querySelectorAll(".dk-thumb").forEach(b => b.classList.toggle("sel", +b.dataset.i === cur));
  document.querySelector(`.dk-thumb[data-i="${cur}"]`)?.scrollIntoView({ block: "nearest" });
}

export function go(i, how = "key") {
  if (!deck) return false;
  const n = Math.max(0, Math.min(deck.count - 1, i));
  if (n === cur) {
    if (how === "gesture") feedback(i > cur ? "end" : "start");
    return false;
  }
  const dir = n > cur ? "next" : "prev";
  cur = n;
  if (black) setBlack(false);
  show(cur);
  if (how === "gesture") feedback(dir);
  return true;
}
const next = how => go(cur + 1, how), prev = how => go(cur - 1, how);
$("dkPrev").onclick = () => prev("click");
$("dkNext").onclick = () => next("click");

let flashT = 0;
function feedback(kind) {
  const f = $("dkFlash");
  const label = { next: "Next", prev: "Previous", end: "Last slide", start: "First slide" }[kind];
  f.innerHTML = `${kind === "prev" || kind === "start" ? icon("chevronLeft", 40) : icon("chevronRight", 40)}<span>${label}</span>`;
  f.className = `dk-flash show ${kind}`;
  clearTimeout(flashT);
  flashT = setTimeout(() => f.classList.remove("show"), 700);
  $("dkCam").classList.remove("hit"); void $("dkCam").offsetWidth; $("dkCam").classList.add("hit");
}

function setBlack(v) { black = v; $("dkBlack").classList.toggle("hidden", !v); }

// re-fit the slide when the stage changes size (window resize, full screen, panel)
let fitT = 0;
new ResizeObserver(() => { clearTimeout(fitT); fitT = setTimeout(() => deck && show(cur, true), 120); }).observe(stage);

// ------------------------------------------------------------ full screen
async function toggleFull() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else { await stage.requestFullscreen({ navigationUI: "hide" }); stage.focus({ preventScroll: true }); }
  } catch { toast("Full screen is not available here. Press F11 for browser full screen.", "warning", 4000); }
}
$("dkFull").onclick = toggleFull;
document.addEventListener("fullscreenchange", () => {
  const fs = document.fullscreenElement === stage;
  stage.classList.toggle("fs", fs);
  $("dkFull").innerHTML = fs ? `${icon("minimize")}<span>Exit</span>` : `${icon("maximize")}<span>Present</span>`;
});

// --------------------------------------------------------------- keyboard
window.addEventListener("keydown", e => {
  if (twin.section !== "deck" || e.target.closest?.("input, select, textarea") || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if ((k === " " || k === "Enter") && e.target.closest?.("button")) return;   // the focused button handles it
  if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter", "n"].includes(k)) { next("key"); e.preventDefault(); }
  else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace", "p"].includes(k)) { prev("key"); e.preventDefault(); }
  else if (k === "Home") { go(0, "key"); e.preventDefault(); }
  else if (k === "End") { deck && go(deck.count - 1, "key"); e.preventDefault(); }
  else if (k === "f" || k === "F5") { toggleFull(); e.preventDefault(); }
  else if (k === "g") setGestures(!gesturesOn);
  else if (k === "c") setCamVisible(!prefs.camVisible);
  else if (k === "b" || k === ".") setBlack(!black);
});

// ---------------------------------------------------------------- gestures
async function setGestures(v) {
  gesturesOn = v;
  detector.reset();
  renderGestureUi();
  if (v) {
    const ok = await vision.start($("dkVideo"));
    if (!ok) { gesturesOn = false; renderGestureUi(); if (vision.state === "error") toast(vision.message, "warning", 5000); }
  } else vision.stop();
}
$("dkGest").onclick = () => setGestures(!gesturesOn);
$("dkSens").value = prefs.sens;
$("dkSens").onchange = e => { prefs.sens = e.target.value; detector.setSensitivity(prefs.sens); detector.reset(); savePrefs(); };
$("dkReverse").checked = prefs.reverse;
$("dkReverse").onchange = e => { prefs.reverse = e.target.checked; savePrefs(); renderGestureUi(); };

vision.onState(() => renderGestureUi());
vision.onResult(r => {
  if (!gesturesOn) return;
  const dir = detector.update(performance.now(), r.hands, r.aspect);
  drawCam(r);
  $("dkMeter").style.width = `${Math.round(detector.progress * 100)}%`;
  if (!dir) {
    if (detector.why) { whyText = detector.why; gestureWhyAt = performance.now(); }
    const seen = !r.hands.length ? "No hand seen. Hold an open hand up to the camera."
      : performance.now() - gestureWhyAt < 2500 ? `Ignored: ${whyText}`
      : "Hand seen. Swipe sideways with an open palm.";
    if (seen !== lastSeen) { lastSeen = seen; $("dkLast").textContent = seen; }
    return;
  }
  lastSeen = "";
  stats.swipes++; stats.last = dir; stats.lastAt = Date.now();
  const forward = prefs.reverse ? dir === "left" : dir === "right";
  if (twin.section === "deck" && deck) forward ? next("gesture") : prev("gesture");
  $("dkLast").textContent = `Swipe ${dir} at ${new Date().toLocaleTimeString()}`;
});

function renderGestureUi() {
  const st = gesturesOn ? vision.state : "off";
  const b = $("dkGest");
  b.classList.toggle("btn-primary", gesturesOn && st === "on");
  b.setAttribute("aria-pressed", String(gesturesOn));
  b.innerHTML = `${icon("hand")}<span>${!gesturesOn ? "Gestures off" : st === "starting" ? "Starting..." : st === "on" ? "Gestures on" : "Gestures off"}</span>`;
  const line = !gesturesOn ? "Off. Turn on to change slides with a swipe."
    : st === "starting" ? vision.message
    : st === "on" ? (vision.fps ? `Watching for swipes. ${prefs.reverse ? "Swipe left = next" : "Swipe right = next"}.` : "Starting hand tracking (a few seconds the first time)...")
    : vision.message;
  $("dkGestState").textContent = line;
  $("dkGestDot").className = `dot ${gesturesOn && st === "on" ? "on" : ""}`;
  $("dkCam").classList.toggle("hidden", !(gesturesOn && prefs.camVisible));
  $("dkCamToggle").innerHTML = icon(prefs.camVisible ? "eye" : "eyeOff");
  $("dkCamToggle").setAttribute("aria-label", prefs.camVisible ? "Hide the camera preview" : "Show the camera preview");
  $("dkHudGest").textContent = gesturesOn && st === "on" ? "Gestures on" : "Gestures off";
}
setInterval(() => {
  if (!gesturesOn || vision.state !== "on") return;
  $("dkFps").textContent = `${vision.fps} fps, ${vision.ms.toFixed(0)} ms per frame (${vision.delegate})`;
  if (vision.fps && $("dkGestState").textContent.startsWith("Starting")) renderGestureUi();
  if (deck && startedAt) { const s = Math.floor((Date.now() - startedAt) / 1000); $("dkTimer").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
}, 500);

// ------------------------------------------------------ camera preview (PiP)
const cam = $("dkCam"), camCv = $("dkCamCv");
function setCamVisible(v) { prefs.camVisible = v; savePrefs(); renderGestureUi(); }
$("dkCamToggle").onclick = () => setCamVisible(!prefs.camVisible);
$("dkCamHide").onclick = () => setCamVisible(false);
$("dkCamSize").onclick = () => { prefs.camSize = prefs.camSize === "m" ? "s" : prefs.camSize === "s" ? "l" : "m"; savePrefs(); placeCam(); };
function placeCam() {
  cam.dataset.corner = prefs.corner; cam.dataset.size = prefs.camSize;
  cam.style.left = cam.style.top = cam.style.right = cam.style.bottom = "";
}
placeCam();
// drag anywhere, then it snaps to the nearest corner (so it never ends up over the middle of a slide)
let drag = null;
cam.addEventListener("pointerdown", e => {
  if (e.target.closest("button")) return;
  const r = cam.getBoundingClientRect(), s = stage.getBoundingClientRect();
  drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, s };
  cam.setPointerCapture(e.pointerId); cam.classList.add("dragging");
});
cam.addEventListener("pointermove", e => {
  if (!drag) return;
  const { s } = drag;
  cam.style.right = cam.style.bottom = "auto";
  cam.style.left = `${Math.max(0, Math.min(s.width - cam.offsetWidth, e.clientX - s.left - drag.dx))}px`;
  cam.style.top = `${Math.max(0, Math.min(s.height - cam.offsetHeight, e.clientY - s.top - drag.dy))}px`;
});
cam.addEventListener("pointerup", e => {
  if (!drag) return;
  const r = cam.getBoundingClientRect(), s = drag.s;
  const cx = r.left + r.width / 2 - s.left, cy = r.top + r.height / 2 - s.top;
  prefs.corner = (cy < s.height / 2 ? "t" : "b") + (cx < s.width / 2 ? "l" : "r");
  drag = null; cam.classList.remove("dragging"); savePrefs(); placeCam();
});

function drawCam(r) {
  if (!prefs.camVisible) return;
  const v = $("dkVideo"), c = camCv.getContext("2d");
  const w = camCv.width = camCv.clientWidth * (window.devicePixelRatio || 1), h = camCv.height = camCv.clientHeight * (window.devicePixelRatio || 1);
  c.save(); c.translate(w, 0); c.scale(-1, 1);
  if (v.readyState >= 2) c.drawImage(v, 0, 0, w, h);
  c.restore();
  c.lineWidth = Math.max(2, w / 110); c.lineCap = "round";
  for (const lm of r.hands) {
    c.strokeStyle = "#7b96ff";
    for (const [a, b] of HAND_BONES) { c.beginPath(); c.moveTo((1 - lm[a][0]) * w, lm[a][1] * h); c.lineTo((1 - lm[b][0]) * w, lm[b][1] * h); c.stroke(); }
  }
  $("dkCamStatus").textContent = r.hands.length ? "Hand seen" : "No hand";
}

// leaving the section: stop the camera (and come back to it off)
on("section", name => {
  if (name !== "deck" && gesturesOn) setGestures(false);
  if (name !== "deck" && document.fullscreenElement === stage) document.exitFullscreen().catch(() => {});
});
document.addEventListener("visibilitychange", () => { if (document.hidden) detector.reset(); });

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
renderGestureUi(); updateCounters(); hydrateIcons(stage);
