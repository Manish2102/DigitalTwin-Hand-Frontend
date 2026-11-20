// voice.js - "Hey duck, pull the slide to the right": voice commands for GestureDeck.
//
// Uses the browser's speech recognition (Chrome and Edge: SpeechRecognition / webkitSpeechRecognition). NOTE: in those browsers the
// audio is sent to the browser maker's speech service to be turned into text, so this is off until you switch it on, and it
// needs the microphone. Commands only count after the wake words "hey duck" (so normal talking during a presentation does
// nothing), either in the same sentence or in the next sentence said within 6 seconds.
//
// What it understands after "hey duck":
//   "pull the slide to the right" / "right"   -> the ducks pull the slide off to the right (the same as a swipe right)
//   "pull the slide to the left"  / "left"    -> pulled off to the left
//   "next" / "previous" (or "back")           -> next / previous slide
//   "first" / "last"                          -> jump to the first / last slide

const WAKE = /\b(?:hey|hay|hi|hello|okay|ok)[\s,]+(?:duck|ducks|duke|dock|dak|dug)\b/;
const WAKE_WINDOW_MS = 6000;

// Turns what was heard into a command, or null. wake: whether the wake words were already heard (previous sentence).
export function parseCommand(text, armed = false) {
  const t = String(text || "").toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return { cmd: null, woke: armed };
  const m = WAKE.exec(t);
  const rest = m ? t.slice(m.index + m[0].length) : (armed ? t : null);
  if (rest === null) return { cmd: null, woke: false };
  const w = ` ${rest} `;
  let cmd = null;
  if (/\b(right|rite)\b/.test(w)) cmd = { type: "pull", side: "right" };
  else if (/\bleft\b/.test(w)) cmd = { type: "pull", side: "left" };
  else if (/\b(next|forward|advance|continue)\b/.test(w)) cmd = { type: "step", dir: "next" };
  else if (/\b(previous|prev|back|backward|before)\b/.test(w)) cmd = { type: "step", dir: "prev" };
  else if (/\b(first|beginning|start)\b/.test(w)) cmd = { type: "jump", to: "first" };
  else if (/\b(last|end|final)\b/.test(w)) cmd = { type: "jump", to: "last" };
  return { cmd, woke: !!(m || armed) && !cmd };       // woke: waiting for the command in the next sentence
}

export class VoiceControl {
  constructor({ onCommand, onState, onHeard, lang = "en-US" } = {}) {
    this.onCommand = onCommand ?? (() => {}); this.onState = onState ?? (() => {}); this.onHeard = onHeard ?? (() => {});
    this.lang = lang; this.state = "off"; this.message = "Voice control is off.";
    this.wanted = false; this.rec = null; this.armedUntil = 0; this.firedFor = new Set(); this.retryT = 0;
  }
  static get Engine() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; }
  get supported() { return !!VoiceControl.Engine; }
  _set(state, message) { this.state = state; this.message = message; this.onState(state, message); }

  // text arrives from the engine (or from tests): look for the wake words and a command
  feed(text, idx = -1) {
    const now = Date.now();
    const r = parseCommand(text, now < this.armedUntil);
    if (r.cmd) {
      if (idx >= 0) { if (this.firedFor.has(idx)) return null; this.firedFor.add(idx); }
      this.armedUntil = 0;
      this.onHeard(text, r.cmd);
      this.onCommand(r.cmd, text);
      return r.cmd;
    }
    if (r.woke) { this.armedUntil = now + WAKE_WINDOW_MS; this.onHeard(text, null, true); }
    return null;
  }

  start() {
    if (!this.supported) { this._set("error", "This browser has no speech recognition. Use Chrome or Edge."); return false; }
    this.wanted = true; this._open();
    return true;
  }
  stop() {
    this.wanted = false; clearTimeout(this.retryT);
    try { this.rec?.abort(); } catch {}
    this.rec = null; this._set("off", "Voice control is off.");
  }
  _open() {
    clearTimeout(this.retryT);
    const Engine = VoiceControl.Engine;
    if (!Engine) return;
    try { this.rec?.abort(); } catch {}
    const rec = this.rec = new Engine();
    rec.continuous = true; rec.interimResults = true; rec.lang = this.lang; rec.maxAlternatives = 1;
    rec.onstart = () => { this.firedFor.clear(); this._set("listening", 'Listening. Say "Hey duck, pull the slide to the right".'); };
    rec.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0]?.transcript ?? "";
        this.feed(text, i);                                    // a clear partial result is acted on at once; its final version is then skipped
        if (e.results[i].isFinal) this.firedFor.delete(i);
      }
    };
    rec.onerror = e => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { this.wanted = false; this._set("error", "The microphone is blocked. Allow it for this site in the address bar, then switch voice control on again."); }
      else if (e.error === "audio-capture") { this.wanted = false; this._set("error", "No microphone was found."); }
      else if (e.error === "network") this._set("error", "Speech recognition needs an internet connection. Trying again...");
      else this._set("error", `Speech recognition problem (${e.error}).`);
    };
    rec.onend = () => { if (this.rec === rec && this.wanted) this.retryT = setTimeout(() => this._open(), 300); };    // the engine stops now and then: carry on
    try { rec.start(); } catch (err) { this.retryT = setTimeout(() => this._open(), 800); }
  }
}
