// engine.js - the small runtime every game shares.
//
// A game is a plain object (see games.js for the list):
//   { id, title, desc, icon, sensor, modes:[{id,label,players,scored}], howto:[...],
//     init(g, mode) -> state, update(g, state, dt), draw(g, state) }
// Games draw on a fixed 960 x 600 canvas; the engine scales it to the screen. The engine provides the
// 60 Hz loop, a 3-2-1 countdown, pause, per-player scores, best scores in localStorage, sounds, and
// buzz/score messages back to the phones.

import { twin, sendToPhone } from "../core.js";
import { inputs, poll, calibrate, reset, setActive, mouseMove } from "./input.js";

export const W = 960, H = 600;
export const C = { bg: "#0b0d11", surface: "#111419", s2: "#161a20", s3: "#1c2129", border: "#232932", border2: "#2f3641",
                   text: "#e7e9ec", text2: "#a7aeb8", text3: "#868e9a", accent: "#7b96ff", accentSolid: "#4361e8",
                   ok: "#46c068", warn: "#e0a83a", bad: "#f2665e", violet: "#c47dff", cyan: "#4fc3f7" };
export const P_COLOR = { 1: C.accent, 2: C.warn };
const STEP = 1 / 60;
const COUNTDOWN = 3;

let canvas, ctx, frame, game = null, mode = null, st = null;
let state = "idle";                 // idle | ready | countdown | playing | paused | over
let acc = 0, last = 0, raf = 0, running = false, countdown = 0, result = null;
let sentScore = [0, -1, -1], lastScoreSend = 0;
const listeners = [];
export const onChange = fn => listeners.push(fn);
const emitChange = () => listeners.forEach(fn => fn(state, { game, mode, result, score: g.score }));

// ------------------------------------------------------------ what games use
export const g = {
  W, H, C,
  get ctx() { return ctx; },
  get mode() { return mode; },
  get time() { return playTime; },
  score: [0, 0, 0],                                  // index = player number
  input: p => inputs[p],
  addScore(p, n) { g.score[p] += n; },
  setScore(p, n) { g.score[p] = n; },
  end(r) { if (state === "playing") finish(r); },
  sfx,
  buzz(p, pattern) {                                 // vibrate that player's phone
    if (twin.players[p]) sendToPhone({ type: "game", to: p, event: "buzz", vibrate: pattern });
  },
};
let playTime = 0;

// -------------------------------------------------------------------- sound
let actx = null, muted = true;
export function setMuted(m) { muted = m; }
export const isMuted = () => muted;
const SFX = { tick: [660, .05, "square"], good: [880, .09, "triangle"], bad: [150, .22, "sawtooth"],
              win: [1040, .25, "triangle"], lose: [110, .4, "sawtooth"], go: [990, .18, "square"], bounce: [420, .05, "triangle"] };
export function sfx(name) {
  if (muted) return;
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    const [f, d, type] = SFX[name] ?? SFX.tick;
    const o = actx.createOscillator(), v = actx.createGain();
    o.type = type; o.frequency.value = f;
    v.gain.setValueAtTime(0.06, actx.currentTime);
    v.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + d);
    o.connect(v); v.connect(actx.destination); o.start(); o.stop(actx.currentTime + d);
  } catch {}
}

// -------------------------------------------------------------- best scores
const KEY = "dtl.scores";
function readAll() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
export function bestScores(gameId, modeId) { return readAll()[`${gameId}:${modeId}`] ?? []; }
export function bestScore(gameId, modeId) { return bestScores(gameId, modeId)[0]?.score ?? 0; }
function recordScore(gameId, modeId, score) {
  const all = readAll(), k = `${gameId}:${modeId}`;
  const list = all[k] ?? [];
  const isBest = score > (list[0]?.score ?? 0);
  list.push({ score, date: new Date().toISOString().slice(0, 10) });
  list.sort((a, b) => b.score - a.score);
  all[k] = list.slice(0, 5);
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {}
  return isBest;
}
export function clearScores() { try { localStorage.removeItem(KEY); } catch {} }

// ------------------------------------------------------------------ control
export function mount(canvasEl, frameEl) {
  canvas = canvasEl; frame = frameEl; ctx = canvas.getContext("2d");
  new ResizeObserver(fit).observe(frame.parentElement);
  canvas.addEventListener("mousemove", e => {
    const r = canvas.getBoundingClientRect();
    mouseMove((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "playing") pause(); });
  fit();
}

function fit() {
  if (!frame) return;
  const box = frame.parentElement, pad = 16;
  const bw = box.clientWidth - pad * 2, bh = box.clientHeight - pad * 2;
  if (bw <= 0 || bh <= 0) return;
  let w = bw, h = w * H / W;
  if (h > bh) { h = bh; w = h * W / H; }
  frame.style.width = `${Math.floor(w)}px`; frame.style.height = `${Math.floor(h)}px`;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
  draw();
}

export function load(gameDef, modeDef) {
  game = gameDef; mode = modeDef;
  g.score = [0, 0, 0]; playTime = 0; result = null;
  st = game.init(g, mode);
  setState("ready");
  setActive(true); start();
}
export function play() {
  if (!game || (state !== "ready" && state !== "over")) return;
  if (state === "over") load(game, mode);
  reset();
  countdown = COUNTDOWN;
  setState("countdown");
  sfx("tick");
  say("Get ready - hold the phone in your starting grip");
}
export function pause() { if (state === "playing") setState("paused"); }
export function resume() { if (state === "paused") { setState("playing"); last = performance.now(); } }
export function stop() {
  setActive(false); running = false; cancelAnimationFrame(raf);
  game = null; st = null; state = "idle";
}
// The Arcade section is hidden while another twin is open: stop the loop and the keyboard, then pick up again.
export function suspend() { running = false; cancelAnimationFrame(raf); setActive(false); }
export function wake() { if (!game) return; setActive(true); fit(); if (!running) start(); }
export const getState = () => state;
export const current = () => ({ game, mode });

function setState(s) { state = s; emitChange(); }
function finish(r) {
  result = r ?? {};
  if (mode.scored) result.best = recordScore(game.id, mode.id, g.score[1]);
  sfx(result.win === false ? "lose" : "win");
  for (const p of [1, 2]) if (p <= mode.players) say(`${result.title ?? "Game over"} - ${g.score[p]}`, p, "over");
  setState("over");
}
function say(text, p, event = "info") {
  for (const q of p ? [p] : [1, 2]) {
    if (q <= (mode?.players ?? 1) && twin.players[q]) sendToPhone({ type: "game", to: q, event, text, game: game?.title, score: g.score[q] });
  }
}

// --------------------------------------------------------------------- loop
function start() {
  if (running) return;
  running = true; last = performance.now(); acc = 0;
  raf = requestAnimationFrame(tick);
}
function tick(now) {
  if (!running) return;
  acc += Math.min(0.1, (now - last) / 1000); last = now;
  while (acc >= STEP) { step(STEP); acc -= STEP; }
  draw();
  raf = requestAnimationFrame(tick);
}
function step(dt) {
  poll(dt);
  if (state === "countdown") {
    const before = Math.ceil(countdown);
    countdown -= dt;
    const after = Math.ceil(countdown);
    if (after !== before && after > 0) sfx("tick");
    if (countdown <= 0) {
      for (const p of [1, 2]) calibrate(p);          // neutral grip = however the phone is held right now
      sfx("go"); playTime = 0;
      setState("playing");
      say("Go!", 0, "start");
    }
  } else if (state === "playing") {
    playTime += dt;
    game.update(g, st, dt);
    const now = performance.now();
    if (now - lastScoreSend > 400) {                  // keep the phone's score card up to date
      lastScoreSend = now;
      for (const p of [1, 2]) if (p <= mode.players && g.score[p] !== sentScore[p]) {
        sentScore[p] = g.score[p];
        if (twin.players[p]) sendToPhone({ type: "game", to: p, event: "score", score: g.score[p], game: game.title });
      }
    }
  }
}

// ------------------------------------------------------------------ drawing
function draw() {
  if (!ctx || !game || !st) return;
  const k = canvas.width / W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  game.draw(g, st);
  if (state === "countdown") {
    ctx.fillStyle = "rgba(11,13,17,.55)"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.text; ctx.font = "700 150px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(Math.ceil(countdown)), W / 2, H / 2 - 10);
    ctx.fillStyle = C.text2; ctx.font = "500 20px Inter, system-ui, sans-serif";
    ctx.fillText("Hold the phone how you want to play", W / 2, H / 2 + 90);
  }
}

// small drawing helpers shared by the games
export function text(t, x, y, { size = 20, weight = 600, color = C.text, align = "left", base = "alphabetic" } = {}) {
  ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillText(t, x, y);
}
export function hud(p, label, value, align = "left") {
  text(label, align === "left" ? 24 : W - 24, 30, { size: 12, weight: 600, color: P_COLOR[p] ?? C.text3, align });
  text(String(value), align === "left" ? 24 : W - 24, 62, { size: 30, weight: 700, align });
}
export function grid(step = 40) {
  ctx.fillStyle = C.border;
  for (let x = step / 2; x < W; x += step) for (let y = step / 2; y < H; y += step) ctx.fillRect(x, y, 1.5, 1.5);
}
export function circle(x, y, r, fill, stroke, lw = 2) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
export function roundRect(x, y, w, h, r, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
