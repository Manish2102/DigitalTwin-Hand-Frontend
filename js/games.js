// games.js - the Arcade section: game menu, play view, overlays, side panel, player 2 pairing.
// The games themselves live in js/games/*.js; this file is only the screen around them.

import { $, on, twin, ROOM } from "./core.js";
import { BACKEND_URL, BACKEND_OVERRIDE } from "./config.js";
import { icon, hydrateIcons } from "./icons.js";
import { toast, copyText } from "./ui.js";
import { setModeExtra, resendMode } from "./nav.js";
import * as engine from "./games/engine.js";
import { calibrate, poseLive, handLive } from "./games/input.js";
import marble from "./games/marble.js";
import slicer from "./games/slicer.js";
import glider from "./games/glider.js";
import rps from "./games/rps.js";
import shake from "./games/shake.js";
import pong from "./games/pong.js";
import slides from "./games/slides.js";
import cricket from "./games/cricket.js";
import carrom from "./games/carrom.js";
import snooker from "./games/snooker.js";
import robot from "./games/robot.js";
import office from "./games/office.js";
import { startCamera, stopCamera, cameraState, cameraMessage, cameraLive, cameraFps, onCamera, mountPreview, gestureLabel } from "./games/camera.js";

export const GAMES = [marble, slicer, glider, rps, shake, pong, cricket, carrom, snooker, robot, slides, office];
const SENSOR = {
  tilt:   { label: "Tilt",          icon: "radio",  need: "Motion sensors" },
  hand:   { label: "Hand camera",   icon: "camera", need: "Hand camera" },
  shake:  { label: "Shake",         icon: "radio",  need: "Motion sensors" },
  webcam: { label: "Laptop camera", icon: "camera", need: "Laptop camera" },
};
const GROUPS = [
  { title: "Phone as the controller", sub: "Tilt, shake or show your hand to the phone.", test: g => g.sensor !== "webcam" },
  { title: "Laptop camera", sub: "Hand tracking runs in this browser with the laptop's own webcam. No phone needed.", test: g => g.sensor === "webcam" },
];
const TWIN_DEFAULT = { entity: "You, holding the phone.", sensors: "Orientation, accelerometer or camera hand tracking, streamed 20 to 30 times a second.",
                       model: "The game world: marble, paddle or glider moves exactly as you move the phone or your hand.", loop: "The phone vibrates on hits and shows your score." };
const usesCamera = g => g.sensor === "webcam" || g.sensor === "hand";
let cur = null, mode = null, mounted = false;
const lastMode = {};                                   // remembers the chosen mode per game this visit
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// what the phone should be told when this section is open
setModeExtra(() => cur
  ? { sensor: cur.sensor, game: cur.title, hint: cur.phone, players: mode?.players ?? 1 }
  : { sensor: null, game: null, hint: "Pick a game on the laptop, then follow the instructions here.", players: 1 });

// -------------------------------------------------------------------- menu
function bestOf(game) {
  const m = game.modes.find(x => x.scored);
  return m ? engine.bestScore(game.id, m.id) : 0;
}
function renderMenu() {
  $("gGrid").innerHTML = GROUPS.map(gr => `<div class="g-group"><b>${esc(gr.title)}</b><span>${esc(gr.sub)}</span></div>` +
    GAMES.filter(gr.test).map(card).join("")).join("");
  $("gGrid").querySelectorAll(".game-card").forEach(b => b.onclick = () => selectGame(b.dataset.game));
}
function card(game) {
    const multi = game.modes.some(m => m.players === 2);
    const best = bestOf(game);
    return `<button class="game-card" data-game="${game.id}">
      <span class="game-ico">${icon(game.icon, 22)}</span>
      <span class="game-name">${esc(game.title)}</span>
      <span class="game-desc">${esc(game.desc)}</span>
      <span class="game-meta">
        <span class="chip">${icon(SENSOR[game.sensor].icon, 13)}${SENSOR[game.sensor].label}</span>
        <span class="chip">${icon(multi ? "users" : "user", 13)}${multi ? "1 or 2 players" : "1 player"}</span>
        ${game.twinDemo ? `<span class="chip">${icon("layers", 13)}Digital twin</span>` : ""}
        ${best ? `<span class="chip chip-best">${icon("trophy", 13)}Best ${best}</span>` : ""}
      </span></button>`;
}

function showMenu() {
  engine.suspend();
  stopCamera();
  cur = null; mode = null;
  $("gPlay").classList.add("hidden"); $("gMenu").classList.remove("hidden");
  renderMenu(); resendMode();
}

function selectGame(id) {
  cur = GAMES.find(x => x.id === id);
  mode = lastMode[id] ?? cur.modes[0];
  $("gMenu").classList.add("hidden"); $("gPlay").classList.remove("hidden");
  if (!mounted) { engine.mount($("gCanvas"), $("gFrame")); mounted = true; }
  $("gTitle").textContent = cur.title;
  const tw = cur.twin ?? TWIN_DEFAULT;
  $("gTwEntity").textContent = tw.entity; $("gTwSensors").textContent = tw.sensors;
  $("gTwModel").textContent = tw.model; $("gTwLoop").textContent = tw.loop;
  $("gCamCard").classList.toggle("hidden", !usesCamera(cur));
  renderCam();
  renderModes(); renderHowto(); loadGame();
  engine.wake();
}

function loadGame() {
  lastMode[cur.id] = mode;
  engine.load(cur, mode);
  renderScores(); renderControllers(); resendMode();
}

// ----------------------------------------------------------------- toolbar
function renderModes() {
  $("gModes").innerHTML = cur.modes.map(m =>
    `<button data-mode="${m.id}" class="${m.id === mode.id ? "sel" : ""}">${icon(m.players === 2 ? "users" : "user", 14)}${esc(m.label)}</button>`).join("");
  $("gModes").style.display = cur.modes.length > 1 ? "" : "none";
  $("gModes").querySelectorAll("button").forEach(b => b.onclick = () => {
    mode = cur.modes.find(m => m.id === b.dataset.mode);
    renderModes(); loadGame();
  });
  $("gP2").style.display = cur.modes.some(m => m.players === 2) ? "" : "none";
  $("gCalibrate").style.display = usesCamera(cur) ? "none" : "";          // neutral tilt only matters for motion games
}
$("gBack").onclick = showMenu;
$("gCalibrate").onclick = () => { calibrate(1); calibrate(2); toast("Neutral position set to the current grip", "success"); };
$("gPause").onclick = () => engine.getState() === "paused" ? engine.resume() : engine.pause();
$("gSound").onclick = () => {
  engine.setMuted(!engine.isMuted());
  $("gSound").innerHTML = icon(engine.isMuted() ? "volumeOff" : "volume");
  $("gSound").setAttribute("aria-label", engine.isMuted() ? "Sound off" : "Sound on");
  $("gSound").setAttribute("data-tip", engine.isMuted() ? "Sound is off" : "Sound is on");
  engine.sfx("good");
};
$("gP2").onclick = () => $("p2Modal").classList.remove("hidden");

// ----------------------------------------------------------------- overlay
function deviceLines() {
  if (cur.sensor === "webcam") {
    const st = cameraState(), on = st === "on";
    return `<div class="dev ${on ? "ok" : ""}"><span class="dot ${on ? "on" : ""}"></span>
      <span>Laptop camera ${on ? "on" : st === "starting" ? "starting..." : "off. The mouse works too."}</span></div>`;
  }
  const need = SENSOR[cur.sensor].need, live = cur.sensor === "hand" ? handLive : poseLive;
  return [1, 2].filter(p => p <= mode.players).map(p => {
    const ok = live(p);
    return `<div class="dev ${ok ? "ok" : ""}"><span class="dot ${ok ? "on" : ""}"></span>
      <span>${mode.players === 2 ? `Player ${p}: ` : ""}${need} ${ok ? "live" : twin.players[p] ? "not shared yet" : "no phone"}</span></div>`;
  }).join("");
}
function startButtons() {
  if (cur.sensor !== "webcam" || cameraLive()) return `<button class="btn btn-primary btn-lg" data-act="start">${icon("play")}Start</button>`;
  const busy = cameraState() === "starting";
  return `<button class="btn btn-primary btn-lg" data-act="camplay" ${busy ? "disabled" : ""}>${icon("camera")}${busy ? "Starting camera..." : "Start camera and play"}</button>
    <button class="btn btn-lg" data-act="start">${icon("play")}Play with the mouse</button>`;
}
function renderOverlay(state, info) {
  const o = $("gOverlay");
  if (state === "countdown" || state === "playing" || state === "idle") { o.classList.add("hidden"); return; }
  o.classList.remove("hidden");
  if (state === "paused") {
    o.innerHTML = `<h2>Paused</h2><div class="g-actions"><button class="btn btn-primary btn-lg" data-act="resume">${icon("play")}Resume</button>
      <button class="btn btn-lg" data-act="menu">All games</button></div>`;
  } else if (state === "over") {
    const r = info.result ?? {}, sc = info.score;
    const body = mode.players === 2
      ? `<div class="g-final"><b style="color:var(--accent)">${Math.round(sc[1])}</b><span>vs</span><b style="color:var(--warning)">${Math.round(sc[2])}</b></div>`
      : `<div class="g-final"><b>${Math.round(sc[1])}</b><span>points</span></div>`;
    o.innerHTML = `<h2>${esc(r.title ?? "Game over")}</h2>
      ${r.detail ? `<p>${esc(r.detail)}</p>` : ""}${body}
      ${r.best ? `<div class="badge badge-success badge-lg">${icon("trophy", 15)}New best score</div>` : ""}
      <div class="g-actions"><button class="btn btn-primary btn-lg" data-act="again">${icon("rotateCcw")}Play again</button>
      <button class="btn btn-lg" data-act="menu">All games</button></div>`;
  } else {
    o.innerHTML = `<h2>${esc(cur.title)}</h2><p>${esc(cur.desc)}</p>
      <div class="g-devices">${deviceLines()}</div>
      <p class="g-phone-hint">${icon("phone", 14)}<span>${esc(cur.phone)}</span></p>
      <div class="g-actions">${startButtons()}
      ${mode.players === 2 && !twin.players[2] ? `<button class="btn btn-lg" data-act="p2">${icon("qr")}Add player 2</button>` : ""}</div>`;
  }
  const first = o.querySelector(".btn-primary"); first?.focus({ preventScroll: true });
}
$("gOverlay").onclick = e => {
  const a = e.target.closest("[data-act]")?.dataset.act;
  if (a === "start" || a === "again") engine.play();
  else if (a === "camplay") startCamera().then(ok => { if (ok && cur && engine.getState() === "ready") engine.play(); });
  else if (a === "resume") engine.resume();
  else if (a === "menu") showMenu();
  else if (a === "p2") $("p2Modal").classList.remove("hidden");
};

engine.onChange((state, info) => {
  if (!cur) return;
  renderOverlay(state, info);
  $("gPause").style.display = state === "playing" || state === "paused" ? "" : "none";
  $("gPause").innerHTML = state === "paused" ? `${icon("play")}<span>Resume</span>` : `${icon("pause")}<span>Pause</span>`;
  if (state === "over") { renderScores(); }
  $("gState").textContent = { ready: "Ready", countdown: "Get ready", playing: "Playing", paused: "Paused", over: "Finished" }[state] ?? "";
});

// -------------------------------------------------------------- side panel
function renderHowto() {
  $("gHow").innerHTML = cur.howto.map(t => `<li>${esc(t)}</li>`).join("");
}
function renderScores() {
  const scored = cur.modes.find(m => m.scored), list = scored ? engine.bestScores(cur.id, scored.id) : [];
  $("gScoresMeta").textContent = scored ? scored.label : "";
  $("gScores").innerHTML = list.length
    ? list.map((r, i) => `<li class="log-item"><span class="rank">${i + 1}</span><b class="num">${r.score}</b><span class="subtle">${r.date}</span></li>`).join("")
    : `<li class="empty">${icon("trophy", 22)}<span class="empty-title">${scored ? "No scores yet" : "No scores in this game"}</span>
       <span class="empty-desc">${scored ? "Finish a game to set the first score. Scores stay in this browser." : cur.modes.some(m => m.players === 2) ? "Two-player games are won, not scored." : "This one is a live demo, it has no score."}</span></li>`;
}
function renderControllers() {
  if (!cur) return;
  const rows = [1, 2].map(p => {
    const needed = p <= mode.players, up = twin.players[p];
    const pose = poseLive(p), hand = handLive(p);
    if (cur.sensor === "webcam") {
      if (p === 2) return "";
      const on = cameraLive();
      return `<div class="field"><span class="field-label"><span class="dot ${on ? "on" : ""}"></span> Player 1</span>
        <span><span class="badge ${on ? "badge-success" : ""}">Laptop camera: ${on ? "on" : "off"}</span> <span class="badge">Mouse</span></span></div>`;
    }
    const sensors = cur.sensor === "hand" ? [["Hand camera", hand]] : [["Motion sensors", pose]];
    return `<div class="field"><span class="field-label"><span class="dot ${up ? "on" : ""}"></span> Player ${p}</span>
      <span>${needed ? sensors.map(([n, ok]) => `<span class="badge ${ok ? "badge-success" : up ? "badge-warning" : ""}">${n}: ${ok ? "live" : up ? "not shared" : "no phone"}</span>`).join("") : `<span class="subtle">Not used</span>`}</span></div>`;
  });
  $("gControllers").innerHTML = rows.join("");
  const devices = $("gOverlay").querySelector(".g-devices");          // refresh only the status lines, not the buttons
  if (devices) devices.innerHTML = deviceLines();
}
setInterval(() => { if (cur && twin.section === "games") renderControllers(); }, 700);
$("gClearScores").onclick = () => { engine.clearScores(); renderScores(); toast("Best scores cleared", "info"); };

// ---------------------------------------------------------- player 2 modal
const p2Link = new URL("phone.html", location.href);
p2Link.search = new URLSearchParams({ room: ROOM, p: "2", ...(BACKEND_OVERRIDE ? { backend: BACKEND_URL } : {}) });
$("p2Url").textContent = $("p2Url").href = p2Link.href;
if (window.QRCode) new QRCode($("qr2"), { text: p2Link.href, width: 180, height: 180 });
const closeP2 = () => $("p2Modal").classList.add("hidden");
$("p2Close").onclick = $("p2Done").onclick = closeP2;
$("p2Modal").onclick = e => { if (e.target === $("p2Modal")) closeP2(); };
window.addEventListener("keydown", e => { if (e.key === "Escape") closeP2(); });
$("copyP2").onclick = () => copyText(p2Link.href, "Player 2 link copied");
on("phoneConnected", p => { if (p === 2) { closeP2(); if (cur) { renderControllers(); } } });

// ----------------------------------------------------------- laptop camera
mountPreview($("gCamPrev"));
const camLine = () => `${gestureLabel()}${cameraFps() ? ` - ${cameraFps()} fps` : ""}`;
function renderCam() {
  const st = cameraState(), on = st === "on";
  $("gCamState").textContent = { off: "Off", starting: "Starting", on: "On", error: "Not available" }[st];
  $("gCamPrev").classList.toggle("hidden", !on);
  $("gCamBtn").innerHTML = on ? `${icon("stop")}<span>Stop camera</span>` : `${icon("camera")}<span>${st === "starting" ? "Starting..." : "Start camera"}</span>`;
  $("gCamBtn").disabled = st === "starting";
  $("gCamBtn").classList.toggle("btn-primary", !on && cur?.sensor === "webcam");
  const hint = cur?.sensor === "hand" ? "Optional: use this laptop's camera instead of the phone for player 1."
                                      : "Hand tracking runs in this browser. The picture never leaves the laptop.";
  $("gCamInfo").textContent = on ? camLine() : (st !== "off" && cameraMessage() ? cameraMessage() : hint);
  $("gCamInfo").classList.toggle("cam-err", st === "error");
}
$("gCamBtn").onclick = () => { if (cameraLive()) stopCamera(); else startCamera(); };
onCamera(st => {
  renderCam();
  if (!cur) return;
  renderControllers();
  if (engine.getState() === "ready") renderOverlay("ready", {});
  if (st === "error") toast(cameraMessage(), "warning");
});
setInterval(() => { if (cur && cameraLive() && twin.section === "games") $("gCamInfo").textContent = camLine(); }, 200);

// -------------------------------------------------- leaving / returning
on("section", name => {
  if (name !== "games") { engine.pause(); engine.suspend(); stopCamera(); }
  else if (cur) { engine.wake(); }
});

renderMenu();
hydrateIcons();
