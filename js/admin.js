// admin.js - the Sign twin admin app (admin.html).
//
// You write what the avatar should say; the Sign twin page (same room) says it on its own speakers. It uses the same relay as the
// phone: this page connects to /ws/phone?room=ROOM and the Sign twin page (/ws/twin) receives { type: "admin", cmd, ... }.
//   cmd "say"   { text, label, rate, pitch, voice }   speak this now
//   cmd "stop"                                         stop speaking
//   cmd "lines" { lines: { sign: line } }              replace the line for each sign
//   cmd "hello"                                        presence check; the Sign twin answers { type: "adminAck" }
// "Preview here" speaks on THIS computer only. Lines are stored in this browser (localStorage, same key as the Sign twin page).

import { WS_BASE, roomFromUrl } from "./config.js";
import { SAYINGS } from "./sign/script.js";

const $ = id => document.getElementById(id);
const LINES_KEY = "dtl.signSayings", ROOM_KEY = "dtl.adminRoom", VOICE_KEY = "dtl.adminVoice", AUTO_KEY = "dtl.signAutoSpeak", RATE_KEY = "dtl.adminRate", PITCH_KEY = "dtl.adminPitch";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rd = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let lines = rd(LINES_KEY, null) ?? { ...SAYINGS };
let room = roomFromUrl() ?? rd(ROOM_KEY, "") ?? "";
let ws = null, twinSeen = 0, pending = new Map(), idN = 0, retryT = 0;
const synth = "speechSynthesis" in window ? window.speechSynthesis : null;

// -------------------------------------------------------------- log
const entries = [];
function log(text, kind = "") {
  entries.unshift(`<div class="${kind}">${new Date().toLocaleTimeString()}  ${esc(text)}</div>`); entries.length = Math.min(entries.length, 60);
  $("log").innerHTML = entries.join("");
}

// ------------------------------------------------------------- link
function setBadges() {
  const open = ws?.readyState === 1;
  $("link").textContent = !room ? "Enter a room code" : open ? `Connected: room ${room}` : "Connecting...";
  $("link").className = `badge ${open ? "badge-success" : ""}`;
  const seen = Date.now() - twinSeen < 12000;
  $("twin").textContent = seen ? "Sign twin: online" : "Sign twin: not seen";
  $("twin").className = `badge ${seen ? "badge-success" : "badge-warning"}`;
}
function connect() {
  clearTimeout(retryT);
  try { ws?.close(); } catch {}
  ws = null; twinSeen = 0; setBadges();
  if (!room) return;
  const mine = room;
  const sock = ws = new WebSocket(`${WS_BASE}/ws/phone?room=${mine}`);
  sock.onopen = () => { log(`Connected to room ${mine}`, "ok"); send({ cmd: "hello" }); pushSettings(); setBadges(); };
  sock.onclose = () => { if (ws === sock && room === mine) retryT = setTimeout(connect, 1500); setBadges(); };
  sock.onerror = () => log("Could not reach the backend, retrying", "warn");
  sock.onmessage = e => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.type !== "adminAck") return;
    twinSeen = Date.now(); setBadges();
    const p = pending.get(m.id);
    if (p) { pending.delete(m.id); log(`The Sign twin got it: ${p}`, "ok"); }
    else if (m.cmd === "hello") log(`Sign twin is online (${m.lines} lines)`, "ok");
  };
}
function send(obj) {
  if (ws?.readyState !== 1) return false;
  ws.send(JSON.stringify({ type: "admin", ...obj }));
  return true;
}
setInterval(() => { if (ws?.readyState === 1) send({ cmd: "hello" }); setBadges(); }, 5000);

// ------------------------------------------------------------ speaking
function voiceName() { return $("voice").value || null; }
function say(text, label = "") {
  text = String(text ?? "").trim();
  if (!text) { $("freeMsg").textContent = "Type something first."; return; }
  const id = ++idN;
  if (!send({ cmd: "say", id, text, label, voice: voiceName(), rate: +$("rate").value, pitch: +$("pitch").value })) {
    log("Not connected: enter the room code and press Connect.", "warn"); $("freeMsg").textContent = "Not connected."; return;
  }
  $("freeMsg").textContent = "";
  pending.set(id, text.slice(0, 60));
  log(`Sent to the Sign twin: ${text.slice(0, 80)}`);
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); log("No answer from the Sign twin. Is its page open in this room? Did you click on it once?", "warn"); } }, 4000);
}
function preview(text) {
  text = String(text ?? "").trim();
  if (!text) return;
  if (!synth) { log("This browser cannot speak.", "warn"); return; }
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text), v = synth.getVoices().find(x => x.name === voiceName());
  if (v) u.voice = v;
  u.rate = +$("rate").value; u.pitch = +$("pitch").value;
  u.onerror = e => { if (e.error !== "canceled" && e.error !== "interrupted") log(`The browser could not speak here (${e.error}).`, "warn"); };
  setTimeout(() => synth.speak(u), 60);
  log(`Preview here: ${text.slice(0, 80)}`);
}

// ----------------------------------------------------------- the lines
let pushT = 0;
function saveLines(push = true) {
  wr(LINES_KEY, lines);
  $("sync").textContent = "saved";
  if (!push) return;
  clearTimeout(pushT);
  pushT = setTimeout(() => { if (send({ cmd: "lines", lines })) { $("sync").textContent = "sent to the Sign twin"; log(`Sent ${Object.keys(lines).length} lines to the Sign twin`); } else $("sync").textContent = "saved here (not connected)"; }, 500);
}
function renderLines() {
  $("lines").innerHTML = Object.entries(lines).map(([k, v]) => `<div class="ln">
      <input class="input k" list="signs" value="${esc(k)}" aria-label="Sign" placeholder="sign">
      <input class="input t" value="${esc(v)}" aria-label="What the avatar says" placeholder="what the avatar says" maxlength="500">
      <button class="btn btn-sm btn-primary play" title="Play on the Sign twin">Play</button>
      <button class="btn btn-sm here" title="Preview on this computer">Here</button>
      <button class="btn btn-sm btn-ghost del" aria-label="Remove">&times;</button></div>`).join("") || `<p class="subtle">No lines yet. Press "Add a line".</p>`;
}
function readLines() {
  const out = {};
  $("lines").querySelectorAll(".ln").forEach(r => { const k = r.querySelector(".k").value.trim(), t = r.querySelector(".t").value.trim(); if (k && t) out[k] = t; });
  return out;
}
$("lines").addEventListener("input", () => { lines = readLines(); saveLines(); });
$("lines").addEventListener("click", e => {
  const r = e.target.closest(".ln"); if (!r) return;
  const k = r.querySelector(".k").value.trim(), t = r.querySelector(".t").value;
  if (e.target.closest(".play")) say(t, k);
  else if (e.target.closest(".here")) preview(t);
  else if (e.target.closest(".del")) { r.remove(); lines = readLines(); saveLines(); if (!$("lines").children.length) renderLines(); }
});
$("add").onclick = () => { lines = readLines(); renderLines(); $("lines").insertAdjacentHTML("beforeend", `<div class="ln"><input class="input k" list="signs" aria-label="Sign" placeholder="sign"><input class="input t" aria-label="What the avatar says" placeholder="what the avatar says" maxlength="500"><button class="btn btn-sm btn-primary play">Play</button><button class="btn btn-sm here">Here</button><button class="btn btn-sm btn-ghost del" aria-label="Remove">&times;</button></div>`); $("lines").querySelector(".ln:last-child .k").focus(); };
$("push").onclick = () => { lines = readLines(); wr(LINES_KEY, lines); if (send({ cmd: "lines", lines })) { log(`Sent ${Object.keys(lines).length} lines to the Sign twin`, "ok"); $("sync").textContent = "sent to the Sign twin"; } else log("Not connected: enter the room code and press Connect.", "warn"); };
$("reset").onclick = () => { lines = { ...SAYINGS }; renderLines(); saveLines(); };

// signs for the suggestion list (names as the recogniser uses them)
fetch("docs/isl/index.json").then(r => r.json()).then(i => {
  $("signs").innerHTML = ["Welcome", ...i.words.map(w => w.label)].map(l => `<option value="${esc(l)}">`).join("");
}).catch(() => { $("signs").innerHTML = ["Welcome", ...Object.keys(SAYINGS)].map(l => `<option value="${esc(l)}">`).join(""); });

// ---------------------------------------------------------------- voice
function fillVoices() {
  const vs = synth?.getVoices() ?? [], want = rd(VOICE_KEY, null);
  $("voice").innerHTML = `<option value="">Default voice</option>` + vs.map(v => `<option value="${esc(v.name)}">${esc(v.name)} (${esc(v.lang)})</option>`).join("");
  if (want && vs.some(v => v.name === want)) $("voice").value = want;
}
synth?.addEventListener?.("voiceschanged", fillVoices); fillVoices();
$("voice").onchange = () => { wr(VOICE_KEY, $("voice").value || null); pushSettings(); };
const showSliders = () => { $("rateV").textContent = (+$("rate").value).toFixed(2); $("pitchV").textContent = (+$("pitch").value).toFixed(2); };
// "say each sign out loud", voice, speed and pitch are sent to the Sign twin page, which keeps them for recognised signs too
function pushSettings() {
  wr(AUTO_KEY, $("auto").checked); wr(RATE_KEY, +$("rate").value); wr(PITCH_KEY, +$("pitch").value);
  const ok = send({ cmd: "settings", auto: $("auto").checked, voice: voiceName(), rate: +$("rate").value, pitch: +$("pitch").value });
  $("voiceSync").textContent = ok ? "sent to the Sign twin" : "saved here (not connected)";
}
$("auto").checked = rd(AUTO_KEY, true);
$("rate").value = rd(RATE_KEY, 0.95); $("pitch").value = rd(PITCH_KEY, 1.05);
$("rate").oninput = $("pitch").oninput = showSliders; showSliders();
$("rate").onchange = $("pitch").onchange = $("auto").onchange = pushSettings;

// ----------------------------------------------------------- the rest
$("freeTwin").onclick = () => say($("free").value, "Admin");
$("freeHere").onclick = () => preview($("free").value);
$("stop").onclick = () => { synth?.cancel(); if (send({ cmd: "stop" })) log("Stop sent"); };
$("free").addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) say($("free").value, "Admin"); });
function joinRoom() {
  const r = $("room").value.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(r)) { log("A room code is 4 to 12 letters or digits.", "warn"); return; }
  room = r; wr(ROOM_KEY, r);
  $("openTwin").href = `index.html?room=${r}#signdemo`;
  const u = new URL(location.href); u.searchParams.set("room", r); history.replaceState(null, "", u);
  connect();
}
$("join").onclick = joinRoom;
$("room").addEventListener("keydown", e => { if (e.key === "Enter") joinRoom(); });

renderLines();
$("room").value = room;
if (room) { $("openTwin").href = `index.html?room=${room}#signdemo`; connect(); } else setBadges();
