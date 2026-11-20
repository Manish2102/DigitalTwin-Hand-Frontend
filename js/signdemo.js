// signdemo.js - "Sign twin": a recognised sign triggers a line you wrote, spoken by a talking avatar.
//
// Recognition is real: the same hand and body tracking, models and recogniser as the Sign language page, limited to the signs that
// have a line (js/sign/script.js, editable on this page) plus any signs you taught on the Sign language page (recordings are shared,
// so "Welcome" taught there works here). Nothing is spoken for a "not sure" result. The Sign language page is not changed by this.

import { $, on, twin } from "./core.js";
import { icon, hydrateIcons } from "./icons.js";
import { toast } from "./ui.js";
import { Vision, HAND_BONES } from "./vision/vision.js";
import { loadModel } from "./sign/model.js";
import { Recognizer } from "./sign/recognizer.js";
import { createTalker } from "./sign/talker.js";

const TEMPLATES = "dtl.signTemplates";                       // written by the Sign language page's "Teach it your signs"
const vision = new Vision({ hands: true, pose: true, numHands: 2 });
let rec = null, words = null, loading = null;
const log = [];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const talker = createTalker($("sdPanel"), { toast, onChange: () => applySet() });
window.__signdemo = { vision, talker, get rec() { return rec; }, get log() { return log; } };

// ------------------------------------------------------------------ models
function load() {
  loading ??= loadModel(new URL("./sign/models/words.json", import.meta.url))
    .then(w => { words = w; rec = new Recognizer({ words: w, letters: null }); rec.setMode("words"); applySet(); talker.setLabels(["Welcome", ...w.labels]); return w; })
    .catch(e => { loading = null; throw e; });
  return loading;
}
const unb64 = t => { const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Float32Array(u.buffer); };
function applySet() {
  if (!rec || !words) return;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(TEMPLATES)) || {}; } catch {}
  const t = {};
  for (const [l, arr] of Object.entries(saved)) if (arr.length >= 2) t[l] = arr.map(x => words.standardise(unb64(x)));
  const known = new Set(words.labels), labels = new Set([...talker.labels(), ...Object.keys(t)]);
  rec.setTemplates(t);
  rec.setSubset([...labels].filter(l => known.has(l) || t[l]));   // a line for a sign nobody can recognise is ignored
}

// ------------------------------------------------------------------ camera
$("sdCam").onclick = async () => {
  talker.unlock();                                           // this click lets the browser speak on this page
  if (vision.state === "on") { vision.stop(); return; }
  try { await load(); } catch (e) { toast(`Could not load the sign model: ${e.message}`, "warning", 5000); return; }
  const ok = await vision.start($("sdVideo"));
  if (!ok && vision.state === "error") toast(vision.message, "warning", 5000);
};
vision.onState(st => {
  $("sdCam").innerHTML = st === "on" ? `${icon("stop")}<span>Stop camera</span>` : `${icon("camera")}<span>${st === "starting" ? "Starting..." : "Start camera"}</span>`;
  $("sdCam").classList.toggle("btn-primary", st !== "on");
  $("sdCam").disabled = st === "starting";
  $("sdEmpty").classList.toggle("hidden", st === "on");
  $("sdEmptyText").textContent = st === "error" || st === "starting" ? vision.message : "Start the camera, stand back so your hands and shoulders are in view, sign one word, then lower your hands. The avatar says the line you wrote for it.";
  $("sdState").textContent = st === "on" ? "Starting hand tracking (a few seconds the first time)..." : "Camera off";
  $("sdState").className = st === "on" ? "badge badge-accent" : "badge";
  rec?.reset();
});

// ------------------------------------------------------------ recognition
vision.onResult(r => {
  if (!rec) return;
  const ev = rec.push(r);
  draw(r);
  const body = rec.bodyVisible, hands = r.hands.length;
  let txt = "Ready: raise your hands to sign", cls = "badge";
  if (!body) { txt = "Step back: shoulders not in view"; cls += " badge-warning"; }
  else if (rec.status === "signing") { txt = "Signing... lower your hands when done"; cls += " badge-accent"; }
  else if (rec.status === "waitRest") { txt = "Lower your hands to finish"; cls += " badge-warning"; }
  else if (hands) txt = "Hands low: raise them to sign";
  $("sdState").textContent = txt; $("sdState").className = cls;
  $("sdFps").textContent = `${vision.fps} fps${vision.delegate ? ` (${vision.delegate})` : ""}`;
  if (ev) handle(ev);
});

function flash(text, kind) {
  const f = $("sdFlash"); f.textContent = text; f.className = `sl-flash show ${kind}`;
  clearTimeout(flash.t); flash.t = setTimeout(() => f.classList.remove("show"), 1600);
}
function handle(ev) {
  if (ev.type === "unsure") {
    flash("Not sure", "unsure");
    $("sdLog").innerHTML = `Not sure (${ev.top.map(t => `${esc(t.label)} ${Math.round(t.p * 100)}%`).join(", ")}). Nothing was said. Sign it again. ` +
      ev.top.map(t => `<button class="btn btn-sm" data-say="${esc(t.label)}">${esc(t.label)}</button>`).join(" ");
    $("sdLog").querySelectorAll("[data-say]").forEach(b => b.onclick = () => said(b.dataset.say, true));
    return;
  }
  if (ev.type === "word") said(ev.label, false, ev.p);
}
function said(label, byHand, p) {
  const line = talker.lineFor(label);
  talker.say(label, "word");
  flash(label, "ok");
  $("sdSaid").textContent = line; $("sdSaid").classList.remove("empty");
  log.unshift({ label, line, byHand: !!byHand, p, at: Date.now() }); log.length = Math.min(log.length, 8);
  $("sdLog").innerHTML = log.map(l => `<div><b>${esc(l.label)}</b> ${l.byHand ? "(chosen by you)" : l.p ? `(${Math.round(l.p * 100)}% sure)` : ""}: ${esc(l.line)}</div>`).join("");
}

// skeleton over the mirrored camera picture
function draw(r) {
  const v = $("sdVideo"), cv = $("sdCanvas"), c = cv.getContext("2d");
  const w = cv.width = cv.clientWidth * (window.devicePixelRatio || 1), h = cv.height = cv.clientHeight * (window.devicePixelRatio || 1);
  const va = r.aspect || 4 / 3, ca = w / h;
  const dw = ca > va ? h * va : w, dh = ca > va ? h : w / va, ox = (w - dw) / 2, oy = (h - dh) / 2;
  c.fillStyle = "#050608"; c.fillRect(0, 0, w, h);
  c.save(); c.translate(ox + dw, oy); c.scale(-1, 1);
  if (v.readyState >= 2) c.drawImage(v, 0, 0, dw, dh);
  c.restore();
  const X = x => ox + (1 - x) * dw, Y = y => oy + y * dh;
  c.lineCap = "round"; c.lineWidth = Math.max(2, dw / 260);
  r.hands.forEach((lm, k) => {
    c.strokeStyle = k ? "#e0a83a" : "#7b96ff";
    for (const [a, b] of HAND_BONES) { c.beginPath(); c.moveTo(X(lm[a][0]), Y(lm[a][1])); c.lineTo(X(lm[b][0]), Y(lm[b][1])); c.stroke(); }
  });
}

on("section", name => {
  if (name !== "signdemo" && vision.state !== "off") vision.stop();
  if (name === "signdemo") load().catch(e => toast(`Could not load the sign model: ${e.message}`, "warning", 5000));
});
hydrateIcons($("sec-signdemo"));
if (twin.section === "signdemo") load().catch(() => {});
