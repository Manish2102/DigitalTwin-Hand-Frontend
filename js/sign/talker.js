// talker.js - the avatar and voice for the Sign language section.
//
// When a sign is recognised, the avatar says the line for it out loud (browser speech synthesis) and its mouth moves while it
// talks. The lines come from sign/script.js and can be edited on the page. Cards are built here and added to the side panel,
// so the page's HTML does not change. Nothing is sent anywhere: speech runs in the browser.

import { SAYINGS } from "./script.js";

const LINES_KEY = "dtl.signSayings", AUTO_KEY = "dtl.signAutoSpeak";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rd = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const CSS = `
  .tk-avatar { display:flex; gap:12px; align-items:center; }
  .tk-avatar svg { width: 104px; height: 114px; flex: none; }
  .tk-bubble { flex:1; min-height: 52px; padding: 8px 12px; border-radius: 12px; background: var(--surface-2, #1b2230); border: 1px solid var(--border, #2b3445); font-size: 14px; line-height: 1.35; position: relative; }
  .tk-bubble.idle { color: var(--text-muted, #8b95a7); }
  .tk-bubble.talking { border-color: var(--accent, #7b96ff); }
  .tk-row { display:flex; gap:6px; margin-bottom:6px; align-items:center; }
  .tk-row .input { min-width: 0; } .tk-row .tk-l { flex: 0 0 34%; } .tk-row .tk-t { flex: 1; }
  .tk-tools { display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin: 8px 0 0; }
`;

export function createTalker(panel, { toast = () => {}, onChange = () => {} } = {}) {
  const style = document.createElement("style"); style.textContent = CSS; document.head.appendChild(style);
  const wrap = document.createElement("div");
  wrap.innerHTML = `
  <div class="card" id="tkCard">
    <div class="card-head"><span class="card-title">Avatar and voice</span><span class="card-meta" id="tkVoice"></span></div>
    <div class="tk-avatar">
      <svg viewBox="0 0 200 220" id="tkSvg" role="img" aria-label="Talking avatar">
        <path d="M20 220 C24 170 60 156 100 156 C140 156 176 170 180 220 Z" fill="#4f6ef7"/>
        <rect x="86" y="132" width="28" height="30" rx="8" fill="#e8b48c"/>
        <g id="tkHead">
          <ellipse cx="100" cy="92" rx="50" ry="56" fill="#f2c29b"/>
          <path d="M50 86 C48 40 84 28 110 32 C146 36 156 66 150 90 C140 62 118 56 96 58 C76 60 58 68 50 86 Z" fill="#2c2a35"/>
          <g id="tkEyes"><ellipse id="tkEyeL" cx="80" cy="92" rx="6" ry="7" fill="#1d1d28"/><ellipse id="tkEyeR" cx="120" cy="92" rx="6" ry="7" fill="#1d1d28"/></g>
          <path d="M68 78 Q80 72 92 78" stroke="#2c2a35" stroke-width="3" fill="none" stroke-linecap="round"/>
          <path d="M108 78 Q120 72 132 78" stroke="#2c2a35" stroke-width="3" fill="none" stroke-linecap="round"/>
          <ellipse cx="100" cy="108" rx="4" ry="5" fill="#e0a37c"/>
          <ellipse id="tkMouth" cx="100" cy="128" rx="14" ry="2.5" fill="#7a2330" stroke="#7a2330" stroke-width="3" stroke-linecap="round"/>
        </g>
      </svg>
      <div class="tk-bubble idle" id="tkBubble" aria-live="polite">Sign something and I will say it.</div>
    </div>
    <div class="tk-tools">
      <label class="subtle" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="tkAuto"> Say each sign out loud</label>
      <button class="btn btn-sm" id="tkTest">Test voice</button>
      <button class="btn btn-sm btn-ghost" id="tkStop">Stop</button>
    </div>
    <div class="subtle" id="tkVoiceStatus" style="margin-top:6px" aria-live="polite">Voice not used yet: press Test voice to hear it.</div>
  </div>
  <div class="card" id="tkLinesCard">
    <div class="card-head"><span class="card-title">What the avatar says</span></div>
    <p class="subtle" style="margin-bottom:8px">Pick a sign and type the line the avatar says when it sees it. A sign without a line is spoken as its own name. Lines are also in <code>js/sign/script.js</code>.</p>
    <div id="tkRows"></div>
    <div class="tk-tools"><button class="btn btn-sm" id="tkAdd">Add a line</button><button class="btn btn-sm btn-ghost" id="tkReset">Reset to defaults</button></div>
    <datalist id="tkLabels"></datalist>
  </div>`;
  const first = panel.firstElementChild;
  for (const c of [...wrap.children]) panel.insertBefore(c, first);

  const $ = id => document.getElementById(id);
  const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
  let lines = rd(LINES_KEY, null) ?? { ...SAYINGS };
  let auto = rd(AUTO_KEY, true), talking = false, level = 0, bubbleT = 0;

  // ----------------------------------------------------------- voice
  function pickVoice() {
    const v = synth?.getVoices() ?? [];
    return v.find(x => x.lang === "en-IN") ?? v.find(x => x.lang?.startsWith("en-GB")) ?? v.find(x => x.lang?.startsWith("en")) ?? null;
  }
  function showVoice() { const v = pickVoice(); $("tkVoice").textContent = !synth ? "no speech in this browser" : v ? v.name.replace(/Microsoft |Google /, "").slice(0, 26) : "default voice"; }
  synth?.addEventListener?.("voiceschanged", showVoice); showVoice();

  let current = null;                                    // keep a reference: some browsers drop an utterance that gets garbage-collected
  function voiceStatus(msg, bad = false) { const e = $("tkVoiceStatus"); if (e) { e.textContent = msg; e.style.color = bad ? "var(--warning, #e0a83a)" : ""; } }
  function speak(text, { cancel = true, rate = 0.95, pitch = 1.05, voice = null } = {}) {
    text = String(text ?? "").trim();
    if (!text) return;
    $("tkBubble").textContent = text; $("tkBubble").classList.remove("idle"); $("tkBubble").classList.add("talking");
    if (!synth) { talking = true; voiceStatus("This browser has no speech synthesis: use Chrome or Edge.", true); clearTimeout(bubbleT); bubbleT = setTimeout(() => stopTalking(), 1200 + text.length * 55); return; }   // no voice: still animate
    const busy = synth.speaking || synth.pending;
    if (cancel && busy) synth.cancel();
    try { synth.resume(); } catch {}
    talking = true;                                       // start moving at once; onend stops it
    let started = false, tries = 0;
    const attempt = () => {
      tries++;
      const u = new SpeechSynthesisUtterance(text), v = (voice && synth.getVoices().find(x => x.name === voice)) || pickVoice();
      if (v) u.voice = v;
      u.rate = rate; u.pitch = pitch; u.volume = 1;
      u.onstart = () => { started = true; talking = true; voiceStatus("Speaking..."); };
      u.onboundary = () => { level = 1; };                // a word starts: open the mouth wide
      u.onend = () => { if (current === u) current = null; if (!synth.speaking && !synth.pending) { stopTalking(); if (started) voiceStatus("Voice OK"); } };
      u.onerror = e => {
        if (e.error === "canceled" || e.error === "interrupted") return;
        voiceStatus(`The browser could not speak (${e.error}). ${e.error === "not-allowed" ? "Click anywhere on the page, then try again." : "Check the sound output."}`, true);
        stopTalking();
      };
      current = u;
      synth.speak(u);
      // if nothing started within 1.5 s, try once more with a fresh utterance, then say so on screen
      setTimeout(() => {
        if (started || current !== u) return;
        if (tries < 2) { try { synth.cancel(); } catch {} setTimeout(attempt, 80); }
        else { voiceStatus("No sound started. Check the computer volume, that this tab is not muted, and the browser's sound output, then press Test voice.", true); stopTalking(); }
      }, 1500);
    };
    if (cancel && busy) setTimeout(attempt, 80); else attempt();   // speaking straight after cancel() can be silent in Chrome
  }
  function stopTalking() {
    talking = false; clearTimeout(bubbleT);
    $("tkBubble").classList.remove("talking");
  }
  $("tkStop").onclick = () => { synth?.cancel(); stopTalking(); };
  $("tkTest").onclick = () => speak(lines.Hello || "Hello! I am the Digital Twin Lab avatar.");
  $("tkAuto").checked = auto;
  $("tkAuto").onchange = e => { auto = e.target.checked; wr(AUTO_KEY, auto); if (!auto) { synth?.cancel(); stopTalking(); } };

  // ------------------------------------------------------- animation
  const mouth = $("tkMouth"), head = $("tkHead"), eyeL = $("tkEyeL"), eyeR = $("tkEyeR");
  let t0 = performance.now(), nextBlink = t0 + 2500, blinkUntil = 0;
  (function frame(now) {
    const t = (now - t0) / 1000;
    let open = 0;
    if (talking) { level *= 0.9; open = Math.min(1, 0.25 + 0.55 * Math.abs(Math.sin(t * 13)) + 0.35 * level); }
    mouth.setAttribute("ry", (2.5 + open * 13).toFixed(1)); mouth.setAttribute("rx", (14 - open * 2).toFixed(1));
    head.setAttribute("transform", talking ? `translate(0 ${(Math.sin(t * 7) * 1.6).toFixed(1)}) rotate(${(Math.sin(t * 3.1) * 1.2).toFixed(1)} 100 150)` : "");
    if (now > nextBlink) { blinkUntil = now + 130; nextBlink = now + 2200 + Math.random() * 2600; }
    const ry = now < blinkUntil ? 0.8 : 7; eyeL.setAttribute("ry", ry); eyeR.setAttribute("ry", ry);
    requestAnimationFrame(frame);
  })(t0);

  // ----------------------------------------------------- the lines
  const save = () => { wr(LINES_KEY, lines); onChange(Object.keys(lines)); };
  function renderRows() {
    $("tkRows").innerHTML = Object.entries(lines).map(([l, t], i) => `<div class="tk-row" data-i="${i}">
      <input class="input tk-l" list="tkLabels" value="${esc(l)}" aria-label="Sign" placeholder="sign">
      <input class="input tk-t" value="${esc(t)}" aria-label="What the avatar says" placeholder="what the avatar says">
      <button class="btn btn-sm btn-icon tk-say" aria-label="Say it" title="Say it">&#9654;</button>
      <button class="btn btn-sm btn-icon tk-del" aria-label="Remove" title="Remove">&times;</button></div>`).join("") || `<p class="subtle">No lines yet: signs are spoken as their own name.</p>`;
  }
  function readRows() {
    const out = {};
    $("tkRows").querySelectorAll(".tk-row").forEach(r => { const l = r.querySelector(".tk-l").value.trim(), t = r.querySelector(".tk-t").value.trim(); if (l && t) out[l] = t; });
    return out;
  }
  $("tkRows").addEventListener("input", () => { lines = readRows(); save(); });
  $("tkRows").addEventListener("click", e => {
    const row = e.target.closest(".tk-row"); if (!row) return;
    if (e.target.closest(".tk-say")) speak(row.querySelector(".tk-t").value);
    if (e.target.closest(".tk-del")) { row.remove(); lines = readRows(); save(); if (!$("tkRows").children.length) renderRows(); }
  });
  $("tkAdd").onclick = () => {
    lines = readRows(); lines[""] = ""; renderRows();
    const rows = $("tkRows").querySelectorAll(".tk-row"); rows[rows.length - 1]?.querySelector(".tk-l")?.focus();
    // an empty row is not saved until both boxes are filled
  };
  $("tkReset").onclick = () => { lines = { ...SAYINGS }; save(); renderRows(); toast("Lines reset to the defaults", "success", 1500); };
  renderRows();

  return {
    speak,
    stop() { synth?.cancel(); stopTalking(); },
    // replace all lines (used by the admin app)
    setLines(obj) { lines = { ...obj }; save(); renderRows(); },
    getLines: () => ({ ...lines }),
    // call from a click (e.g. Start camera): lets the browser know speech is allowed on this page
    unlock() { if (!synth) return; try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; synth.speak(u); } catch {} },
    // a sign was recognised: say its line (words) or its name (letters)
    say(label, type = "word") {
      if (!auto) return;
      const text = type === "word" ? (lines[label] ?? label) : label;
      speak(text, { cancel: type === "word" });
    },
    lineFor: label => lines[label] ?? label,
    labels: () => Object.keys(lines),
    setLabels(list) { $("tkLabels").innerHTML = [...new Set(list)].map(l => `<option value="${esc(l)}">`).join(""); },
    get auto() { return auto; },
  };
}
