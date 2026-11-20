// sign.js - the Sign language section: Indian Sign Language (ISL) to text with the laptop camera.
//
// vision/vision.js tracks hands and the upper body in a worker; sign/recognizer.js turns that stream into words
// (INCLUDE vocabulary) or fingerspelled letters and numbers; this file is the screen around it.
// Models and their measured accuracy come from tools/isl/train.py (see docs/sign-language.md).

import { $, on, twin } from "./core.js";
import { icon, hydrateIcons } from "./icons.js";
import { toast, copyText } from "./ui.js";
import { Vision, HAND_BONES } from "./vision/vision.js";
import { loadModel } from "./sign/model.js";
import { Recognizer, dist, MATCH_D0 } from "./sign/recognizer.js";
import { createTalker } from "./sign/talker.js";
import { REST_Y, anchors } from "./sign/features.js";

// Easy, distinct signs for a talk or demo (each recognised in every test video). A short list is far more accurate than 106 words.
export const DEMO = ["Hello", "Thank you", "How are you", "Good Morning", "I", "you", "Pleased"];   // easy, distinct, 100% in tests
export const WELCOME = "Welcome";    // not in the INCLUDE vocabulary: it works once you teach it (your own sign)
const STORE = "dtl.signTemplates", SETKEY = "dtl.signSet";
let wordSet0 = (() => { try { return localStorage.getItem(SETKEY) || "demo"; } catch { return "demo"; } })();
let wordSet = wordSet0 === "phrases" ? "demo" : wordSet0;
let samples = (() => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } })();   // { label: [base64 float32] }
const talker = createTalker($("sec-sign").querySelector(".panel"), { toast });
const vision = new Vision({ hands: true, pose: true, numHands: 2 });
let rec = null, models = null, modelsP = null, mode = "words";
let text = [];                     // tokens: { t: "word" | "letter" | "space", s }
const hist = [];                   // recent results for the side panel
window.__sign = { vision, get rec() { return rec; }, get text() { return text; }, get models() { return models; } };

function loadModels() {
  modelsP ??= Promise.all([loadModel(new URL("./sign/models/words.json", import.meta.url)), loadModel(new URL("./sign/models/letters.json", import.meta.url))])
    .then(([words, letters]) => { models = { words, letters }; rec = new Recognizer(models); rec.setMode(mode); applyWordSet(); renderTeach(); renderVocab(); talker.setLabels(["Welcome", ...models.words.labels]); renderAccuracy(); return models; })
    .catch(e => { modelsP = null; throw e; });
  return modelsP;
}

// ----------------------------------------------------------------- camera
$("slCam").onclick = async () => {
  if (vision.state === "on") { vision.stop(); return; }
  try { await loadModels(); } catch (e) { toast(`Could not load the sign models: ${e.message}`, "warning", 5000); return; }
  const ok = await vision.start($("slVideo"));
  if (!ok && vision.state === "error") toast(vision.message, "warning", 5000);
};
vision.onState(st => {
  $("slCam").innerHTML = st === "on" ? `${icon("stop")}<span>Stop camera</span>` : `${icon("camera")}<span>${st === "starting" ? "Starting..." : "Start camera"}</span>`;
  $("slCam").classList.toggle("btn-primary", st !== "on");
  $("slCam").disabled = st === "starting";
  $("slEmpty").classList.toggle("hidden", st === "on");
  $("slEmptyText").textContent = st === "error" ? vision.message : st === "starting" ? vision.message : "Start the camera, stand back so your hands and shoulders are in view, and sign.";
  if (st !== "on") { $("slState").textContent = "Camera off"; $("slState").className = "badge"; }
  else { $("slState").textContent = "Starting hand tracking (a few seconds the first time)..."; $("slState").className = "badge badge-accent"; }
  rec?.reset();
});

// ------------------------------------------------------------- recognition
vision.onResult(r => {
  if (!rec) return;
  const ev = rec.push(r);
  draw(r);
  status(r);
  if (ev) handle(ev);
});

function handle(ev) {
  if (ev.type === "sample") { addSample(ev.label, ev.x); return; }
  if (ev.type === "space") { if (text.length && text[text.length - 1].t === "letter") text.push({ t: "space" }); renderText(); return; }
  if (ev.type === "unsure") {
    showResult({ kind: "unsure", top: ev.top, reason: ev.reason });
    return;
  }
  add(ev.type, ev.label);
  talker.say(ev.label, ev.type);
  showResult({ kind: "ok", label: ev.label, p: ev.p, top: ev.top, type: ev.type });
}

function add(type, label) {
  if (type === "word" && text.length && text[text.length - 1].t === "letter") text.push({ t: "space" });
  text.push({ t: type, s: label });
  renderText();
}

function sentence() {
  // letters join into words; words and spelled words are separated by spaces
  let out = "", prev = null;
  for (const tok of text) {
    if (tok.t === "space") { prev = "space"; continue; }
    if (tok.t === "letter") { out += (prev && prev !== "letter" && out ? " " : "") + tok.s; }
    else out += (out ? " " : "") + tok.s;
    prev = tok.t;
  }
  return out;
}
function renderText() {
  const s = sentence();
  $("slText").textContent = s || "";
  $("slText").classList.toggle("empty", !s);
  $("slUndo").disabled = $("slClear").disabled = $("slCopy").disabled = $("slSpeak").disabled = !s;
}

function showResult(r) {
  hist.unshift({ ...r, at: new Date() }); hist.length = Math.min(hist.length, 8);
  const el = $("slResult");
  if (r.kind === "ok") {
    el.innerHTML = `<div class="sl-res ok"><b>${esc(r.label)}</b><span class="badge badge-success">${Math.round(r.p * 100)}% sure</span></div>`;
  } else {
    el.innerHTML = `<div class="sl-res unsure"><b>Not sure</b><span class="subtle">${esc(r.reason)}. Sign it again, or tap the right one:</span>
      <div class="sl-sugg">${r.top.map(t => `<button class="btn btn-sm" data-add="${esc(t.label)}">${esc(t.label)} <span class="subtle">${Math.round(t.p * 100)}%</span></button>`).join("")}</div></div>`;
    el.querySelectorAll("[data-add]").forEach(b => b.onclick = () => { add(mode === "words" ? "word" : "letter", b.dataset.add); talker.say(b.dataset.add, mode === "words" ? "word" : "letter"); el.innerHTML = `<div class="sl-res ok"><b>${esc(b.dataset.add)}</b><span class="badge">added by you</span></div>`; });
  }
  $("slFlash").textContent = r.kind === "ok" ? r.label : "Not sure";
  $("slFlash").className = `sl-flash show ${r.kind}`;
  clearTimeout(showResult.t); showResult.t = setTimeout(() => $("slFlash").classList.remove("show"), 1400);
  $("slHistory").innerHTML = hist.map(h => `<li class="sl-hist"><span class="dot ${h.kind === "ok" ? "on" : ""}"></span><span class="sl-hist-w">${h.kind === "ok" ? esc(h.label) : `Not sure (${esc(h.top[0].label)}?)`}</span><span class="subtle">${h.at.toLocaleTimeString()}</span></li>`).join("");
}

function status(r) {
  const body = rec.bodyVisible, hands = r.hands.length;
  let txt, cls = "badge";
  if (!body) { txt = "Step back: shoulders not in view"; cls += " badge-warning"; }
  else if (!hands) { txt = mode === "words" ? "Ready: raise your hands to sign" : "Ready: show a letter"; }
  else if (rec.status === "signing") { txt = mode === "words" ? "Signing... lower your hands when done" : "Reading the hand shape..."; cls += " badge-accent"; }
  else if (rec.status === "waitRest") { txt = "Lower your hands to finish"; cls += " badge-warning"; }
  else { txt = mode === "words" ? "Hands low: raise them to sign" : "Hold the letter still"; }
  $("slState").textContent = txt; $("slState").className = cls;
  $("slFps").textContent = `${vision.fps} fps${vision.delegate ? ` (${vision.delegate})` : ""}`;
  if (mode === "letters" && rec.live) $("slLive").textContent = rec.status === "signing" ? `Looks like: ${rec.live.map(t => `${t.label} ${Math.round(t.p * 100)}%`).join(", ")}` : "";
  else $("slLive").textContent = "";
}

// skeleton over the mirrored camera picture, and the rest line
function draw(r) {
  const v = $("slVideo"), cv = $("slCanvas"), c = cv.getContext("2d");
  const w = cv.width = cv.clientWidth * (window.devicePixelRatio || 1), h = cv.height = cv.clientHeight * (window.devicePixelRatio || 1);
  // object-fit: contain inside the stage
  const va = r.aspect || 4 / 3, ca = w / h;
  const dw = ca > va ? h * va : w, dh = ca > va ? h : w / va, ox = (w - dw) / 2, oy = (h - dh) / 2;
  c.fillStyle = "#050608"; c.fillRect(0, 0, w, h);
  c.save(); c.translate(ox + dw, oy); c.scale(-1, 1);
  if (v.readyState >= 2) c.drawImage(v, 0, 0, dw, dh);
  c.restore();
  const X = x => ox + (1 - x) * dw, Y = y => oy + y * dh;
  c.lineCap = "round"; c.lineWidth = Math.max(2, dw / 260);
  if (r.pose) {
    c.strokeStyle = "rgba(231,233,236,.55)";
    for (const [a, b] of [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16]]) { const p = r.pose[a], q = r.pose[b]; c.beginPath(); c.moveTo(X(p[0]), Y(p[1])); c.lineTo(X(q[0]), Y(q[1])); c.stroke(); }
    const a = anchors(r.pose, r.aspect);
    if (a) {                                             // the rest line: hands below it are "resting"
      const y = Y(a.cy + REST_Y * a.s);
      c.setLineDash([8, 8]); c.strokeStyle = "rgba(224,168,58,.6)"; c.beginPath(); c.moveTo(ox, y); c.lineTo(ox + dw, y); c.stroke(); c.setLineDash([]);
      c.fillStyle = "rgba(224,168,58,.8)"; c.font = `${Math.round(dh / 36)}px Inter, sans-serif`; c.fillText("rest line: lower your hands below it between signs", ox + 10, y - 6);
    }
  }
  r.hands.forEach((lm, k) => {
    c.strokeStyle = k ? "#e0a83a" : "#7b96ff";
    for (const [a, b] of HAND_BONES) { c.beginPath(); c.moveTo(X(lm[a][0]), Y(lm[a][1])); c.lineTo(X(lm[b][0]), Y(lm[b][1])); c.stroke(); }
  });
}

// ------------------------------------------------------------------- tools
$("slModes").querySelectorAll("button").forEach(b => b.onclick = () => {
  mode = b.dataset.mode;
  $("slModes").querySelectorAll("button").forEach(x => x.classList.toggle("sel", x === b));
  rec?.setMode(mode); applyWordSet();
  $("slHint").textContent = mode === "words"
    ? "Sign one word at a time and lower your hands below the rest line after each word."
    : "Hold each letter or number still for about half a second. Lower your hands to end a word.";
});
$("slUndo").onclick = () => { while (text.length && text[text.length - 1].t === "space") text.pop(); text.pop(); renderText(); };
$("slClear").onclick = () => { text = []; renderText(); };
$("slCopy").onclick = () => copyText(sentence(), "Text copied");
$("slSpeak").onclick = () => { const s = sentence(); if (s) talker.speak(s); };

// ---------------------------------------------------------------- vocabulary
function renderVocab() {
  const q = $("slSearch").value.trim().toLowerCase();
  const cats = {};
  for (const l of models.words.labels) (cats[models.words.categories?.[l] ?? "Words"] ??= []).push(l);
  const letters = models.letters.labels;
  const chip = (l, kind) => `<span class="chip${q && l.toLowerCase().includes(q) ? " hit" : ""}" data-kind="${kind}">${esc(l)}</span>`;
  const sec = (title, list, kind) => {
    const shown = q ? list.filter(l => l.toLowerCase().includes(q)) : list;
    return shown.length ? `<div class="sl-cat"><b>${esc(title.replace(/_/g, " "))}</b> <span class="subtle">${shown.length}</span><div class="sl-chips">${shown.map(l => chip(l, kind)).join("")}</div></div>` : "";
  };
  $("slVocab").innerHTML = Object.entries(cats).map(([c, l]) => sec(c, l, "word")).join("") +
    sec("Fingerspelling: letters", letters.filter(l => !/\d/.test(l)), "letter") + sec("Numbers", letters.filter(l => /\d/.test(l)), "letter") ||
    `<p class="subtle">No sign matches "${esc(q)}".</p>`;
  $("slVocabCount").textContent = `${models.words.labels.length} words, ${letters.length} letters and numbers`;
}
$("slSearch").oninput = () => models && renderVocab();

// tap a sign to see how it is made (illustration + description generated from real signers: docs/isl-reference.md)
let refIndex = null;
$("slVocab").addEventListener("click", async e => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  try { refIndex ??= await (await fetch(new URL("../docs/isl/index.json", import.meta.url))).json(); }
  catch { toast("The sign reference could not be loaded", "warning"); return; }
  const label = chip.textContent, kind = chip.dataset.kind;
  const item = (kind === "word" ? refIndex.words : refIndex.letters).find(x => x.label === label);
  if (!item) return;
  const box = $("slDetail");
  box.innerHTML = `<div class="sl-detail-head"><b>${esc(item.label)}</b>${item.category ? `<span class="subtle">${esc(item.category)}</span>` : ""}
      <button class="btn btn-icon btn-sm" id="slDetailClose" aria-label="Close">${icon("x", 14)}</button></div>
    <img src="${new URL(`../docs/${item.svg}`, import.meta.url)}" alt="Illustration of the ISL sign ${esc(item.label)}">
    <p>${esc(item.text)}</p>
    <p class="subtle">Seen facing the signer: the signer's right hand (blue) is on the left of the picture.${item.accuracy != null ? ` Recognised correctly in ${Math.round(item.accuracy * 100)}% of test ${kind === "word" ? "videos" : "images"}.` : ""}</p>`;
  box.classList.remove("hidden");
  $("slDetailClose").onclick = () => box.classList.add("hidden");
  box.scrollIntoView({ block: "nearest", behavior: "smooth" });
});

function renderAccuracy() {
  const w = models.words.eval, l = models.letters.eval;
  const row = (name, e, what) => e ? `<div class="field"><span class="field-label">${name}</span><span>${Math.round(e.top1 * 100)}% correct on ${e.n} ${what}</span></div>
     <div class="field"><span class="field-label"></span><span class="subtle">When it answers (${Math.round(e.coverage * 100)}% of the time): ${Math.round(e.precision * 100)}% right; otherwise it says "not sure"</span></div>` : "";
  $("slAccuracy").innerHTML = row("Words", w, "test videos") + row("Letters", l, "images of unseen signers");
}

on("section", name => { if (name !== "sign" && vision.state !== "off") vision.stop(); if (name === "sign") loadModels().catch(e => { $("slVocab").innerHTML = `<p class="subtle">Could not load the sign models: ${esc(e.message)}</p>`; }); });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
renderText(); hydrateIcons($("sec-sign"));
if (twin.section === "sign") loadModels().catch(e => { $("slVocab").innerHTML = `<p class="subtle">Could not load the sign models: ${esc(e.message)}</p>`; });


// ------------------------------------------------- word set and "teach my signs"
const b64 = x => { const u = new Uint8Array(new Float32Array(x).buffer); let s = ""; for (const c of u) s += String.fromCharCode(c); return btoa(s); };
const unb64 = t => { const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Float32Array(u.buffer); };
function saveSamples() { try { localStorage.setItem(STORE, JSON.stringify(samples)); } catch { toast("Could not save your recordings in this browser", "warning"); } }
const taught = () => Object.keys(samples).filter(l => samples[l].length >= 2);
let teaching = false;

function applyWordSet() {
  if (wordSet === "mine" && taught().length < 2) wordSet = "demo";
  $("slSets").querySelectorAll("button").forEach(b => b.classList.toggle("sel", b.dataset.set === wordSet));
  $("slSetMine").classList.toggle("hidden", taught().length < 2);
  $("slSetGroup").classList.toggle("hidden", mode !== "words");
  if (!rec || !models) return;
  const labels = models.words.labels, t = {};
  for (const l of taught()) t[l] = samples[l].map(x => models.words.standardise(unb64(x)));
  rec.setTemplates(t);                                        // the user's own recordings help in every set
  if (wordSet === "mine") rec.setSubset(taught());
  else if (wordSet === "demo") rec.setSubset([...DEMO.filter(l => labels.includes(l)), ...taught()]);
  else rec.setSubset(null);
}
$("slSets").querySelectorAll("button").forEach(b => b.onclick = () => {
  wordSet = b.dataset.set; try { localStorage.setItem(SETKEY, wordSet); } catch {}
  applyWordSet();
});

function renderTeach() {
  if (!models) return;
  const sel = $("slTeachWord");
  if (!sel.options.length) {
    const rest = models.words.labels.filter(l => !DEMO.includes(l));
    sel.innerHTML = `<optgroup label="Important"><option value="${WELCOME}">${WELCOME} (teach your own sign)</option></optgroup><optgroup label="Demo signs">${DEMO.map(l => `<option>${esc(l)}</option>`).join("")}</optgroup><optgroup label="Other words">${rest.map(l => `<option>${esc(l)}</option>`).join("")}</optgroup>`;
  }
  const have = Object.entries(samples).filter(([, v]) => v.length);
  $("slTeachList").innerHTML = have.map(([l, v]) => `<span class="chip${v.length >= 3 ? " hit" : ""}">${esc(l)} ${v.length}/3</span>`).join("") || `<span class="subtle">Nothing recorded yet.</span>`;
  $("slTeachCount").textContent = taught().length ? `${taught().length} signs ready` : "";
}
function addSample(label, x) {
  rec.capture = null; teaching = false;
  (samples[label] ??= []).push(b64(x));
  if (samples[label].length > 6) samples[label].shift();
  saveSamples();
  const n = samples[label].length;
  $("slTeachMsg").textContent = n >= 3 ? `${label}: ${n} recordings. Good. Pick the next sign, or try it now.` : `${label}: ${n} of 3 recorded. Record another.`;
  $("slTeachRec").querySelector("span").textContent = "Record a sample";
  if (n >= 2) {                                              // are my repeats alike? (distance in the same units the matcher uses)
    const z = samples[label].map(t => models.words.standardise(unb64(t)));
    const nearest = z.map((a, i) => Math.min(...z.filter((_, j) => j !== i).map(b => dist(a, b))));
    const avg = nearest.reduce((a, b) => a + b, 0) / nearest.length;
    if (avg > MATCH_D0 * 0.95) $("slTeachMsg").textContent = `${label}: your ${n} recordings look quite different from each other. Press "Forget my recordings" or keep recording, and sign it the same way each time.`;
  }
  applyWordSet(); renderTeach();
  toast(`Recorded "${label}" (${n})`, "success", 1800);
}
$("slTeachRec").onclick = () => {
  if (!rec || vision.state !== "on") { toast("Start the camera first", "warning"); return; }
  if (mode !== "words") $("slModes").querySelector('[data-mode="words"]').click();
  if (teaching) { rec.capture = null; teaching = false; $("slTeachMsg").textContent = "Cancelled."; $("slTeachRec").querySelector("span").textContent = "Record a sample"; return; }
  const custom = $("slTeachCustom").value.trim().slice(0, 30);
  const label = custom || $("slTeachWord").value;
  rec.reset(); rec.capture = label; teaching = true;
  $("slTeachMsg").textContent = `Now sign "${label}" the way you will in the talk, then lower your hands.`;
  $("slTeachRec").querySelector("span").textContent = "Cancel";
};
$("slTeachClear").onclick = () => { samples = {}; saveSamples(); if (wordSet === "mine") wordSet = "demo"; applyWordSet(); renderTeach(); $("slTeachMsg").textContent = "Your recordings were removed."; };
