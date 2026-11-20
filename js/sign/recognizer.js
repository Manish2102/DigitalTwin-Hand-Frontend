// recognizer.js - turns the live landmark stream into recognised ISL words or letters, or "not sure".
//
// Words (INCLUDE vocabulary): a sign starts when a hand is raised above the rest line and ends when the hands are
// lowered again (or after MAX_SIGN_MS). The frames in between are classified once. Same trimming as training.
// Letters (fingerspelling A-Z, 0-9): every frame is classified; a letter is accepted when the same answer holds
// with enough confidence for HOLD_MS. The same letter is only accepted again after the hand changes or rests.
//
// Every answer below the model's calibrated threshold (or too close to the second-best answer) is reported as
// "unsure" with the top suggestions, and never added to the text automatically.

import { anchors, frameFeatures, sequenceFeatures, isActive, FRAME_DIM } from "./features.js";

const END_REST_MS = 280, MIN_SIGN_MS = 350, MAX_SIGN_MS = 4500;
const MIN_LIST_MASS = 0.3;       // words from a short list: least network probability the list must hold in total
const HOLD_MS = 650, LETTER_WINDOW = 12, MARGIN = 0.12;
// Distance (standardised features) at which a recording stops looking like one of the user's own: repeats of one sign by one
// person measured about 8-14, other signs 17 and up (tools/isl/experiment_match.py).
export const MATCH_D0 = 17;
export const dist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return Math.sqrt(s); };

export class Recognizer {
  constructor({ words, letters }) {
    this.models = { words, letters };
    this.mode = "words";
    this.subset = null;                    // words: only these labels are possible (a small list is far more accurate)
    this.templates = null;                 // words: the user's own recordings { label: [standardised vectors] }
    this.capture = null;                   // words: label being taught; the next sign is returned as a sample
    this.reset();
  }
  // Restrict the words to a list. Looser threshold (0.45 / margin 0.10): with few candidates a lower probability is
  // still reliable (measured on INCLUDE test videos: answers 95% of signs, 89% right; tools/isl/experiment_phrases.py).
  setSubset(labels) { this.subset = labels?.length ? new Set(labels) : null; }
  setTemplates(t) { this.templates = t && Object.keys(t).length ? t : null; }
  setMode(m) { this.mode = m; this.reset(); }
  reset() {
    this.anchor = null; this.frames = []; this.signing = false; this.signStart = 0; this.restSince = 0; this.waitRest = false;
    this.win = []; this.holdLabel = null; this.holdSince = 0; this.lastLetter = null; this.noHandSince = 0; this.prevChar = null;
    this.status = "idle";                  // idle | signing | thinking | waitRest
  }

  // r: vision result { hands, pose, aspect, ts }; returns an event or null:
  //   { type: "word" | "letter", label, p, top }  confident answer
  //   { type: "unsure", top, reason }              shown as suggestions only
  //   { type: "space" }                            letters mode: hands rested long enough to end a word
  push(r, now = performance.now()) {
    const a = anchors(r.pose, r.aspect) ?? this.anchor;
    if (r.pose && a) this.anchor = a;
    const frame = a ? frameFeatures(r.hands, r.pose, a, r.aspect) : new Float32Array(FRAME_DIM);
    this.bodyVisible = !!anchors(r.pose, r.aspect);
    return this.mode === "words" ? this._word(frame, now) : this._letter(frame, now, r.hands.length);
  }

  _word(f, now) {
    const active = isActive(f);
    if (this.waitRest) {                               // after a forced end, wait for the hands to come down
      if (!active) { if (now - this.restSince > END_REST_MS) { this.waitRest = false; this.status = "idle"; } }
      else this.restSince = now;
      return null;
    }
    if (!this.signing) {
      this.frames.push({ f, t: now });                 // keep a little context from before the hand rose
      if (this.frames.length > 4) this.frames.shift();
      if (active) { this.signing = true; this.signStart = now; this.restSince = 0; this.status = "signing"; }
      return null;
    }
    this.frames.push({ f, t: now });
    if (active) this.restSince = 0; else if (!this.restSince) this.restSince = now;
    const rested = this.restSince && now - this.restSince > END_REST_MS;
    const tooLong = now - this.signStart > MAX_SIGN_MS;
    if (!rested && !tooLong) return null;
    const frames = this.frames;
    this.frames = []; this.signing = false; this.status = "idle";
    if (tooLong) { this.waitRest = true; this.restSince = now; this.status = "waitRest"; }
    if (now - this.signStart < MIN_SIGN_MS) return null;              // a twitch, not a sign
    const x = sequenceFeatures(frames);
    if (!x) return null;
    if (this.capture) return { type: "sample", label: this.capture, x };
    return this._decide(this.models.words, x, "word");
  }

  _letter(f, now, handCount) {
    const present = f[0] > 0 || f[43] > 0;
    if (!present) {
      if (!this.noHandSince) this.noHandSince = now;
      this.win = []; this.holdLabel = null; this.status = "idle";
      if (now - this.noHandSince > 900 && this.lastLetter) { this.lastLetter = null; this.prevChar = null; return { type: "space" }; }
      if (now - this.noHandSince > 300) this.lastLetter = null;        // resting allows the same letter again
      return null;
    }
    this.noHandSince = 0;
    const m = this.models.letters, p = m.predict(f);
    this.win.push(p); if (this.win.length > LETTER_WINDOW) this.win.shift();
    const avg = new Float32Array(p.length);
    for (const q of this.win) for (let i = 0; i < q.length; i++) avg[i] += q[i] / this.win.length;
    // O and 0 share one hand shape in ISL: count them together and choose by context (after a digit -> 0)
    const iO = m.labels.indexOf("O"), i0 = m.labels.indexOf("0");
    if (iO >= 0 && i0 >= 0) {
      const both = avg[iO] + avg[i0], digit = /\d/.test(this.prevChar ?? "");
      avg[digit ? i0 : iO] = both; avg[digit ? iO : i0] = 0;
    }
    const top = m.top(avg, 3), best = top[0];
    this.status = "signing";
    this.live = top;
    const sure = best.p >= m.threshold && best.p - (top[1]?.p ?? 0) >= MARGIN;
    if (!sure) { this.holdLabel = null; return null; }
    if (best.label !== this.holdLabel) { this.holdLabel = best.label; this.holdSince = now; return null; }
    if (now - this.holdSince < HOLD_MS || best.label === this.lastLetter) return null;
    this.lastLetter = best.label; this.prevChar = best.label; this.holdSince = now;
    return { type: "letter", label: best.label, p: best.p, top };
  }

  _decide(model, x, type) {
    if (type === "word" && (this.subset || this.templates)) return this._decideSet(model, x);
    const p = model.predict(x), top = model.top(p, 3), best = top[0];
    if (best.p >= model.threshold && best.p - (top[1]?.p ?? 0) >= MARGIN) return { type, label: best.label, p: best.p, top };
    return { type: "unsure", top, reason: best.p < model.threshold ? "low confidence" : "two signs look alike" };
  }

  // Words from a short list, optionally with the user's own recordings (which may include signs the network does not know,
  // such as "Welcome"). score(label) = network probability among the list, blended with closeness to the user's recordings.
  _decideSet(model, x) {
    const L = model.labels, pm = model.predict(x), T = this.templates ?? {};
    const cand = new Set([...(this.subset ?? L), ...Object.keys(T)]);
    const s = {}; let msum = 0;
    for (let i = 0; i < L.length; i++) if (cand.has(L[i])) { s[L[i]] = pm[i]; msum += pm[i]; }
    // If the network puts little weight on ANY listed sign, the sign is probably not one of them. Re-scaling those tiny numbers
    // up to 100% (as below) is what made one listed word, such as "Thank you", win for every other sign: say "not sure" instead.
    const own = new Set(Object.keys(this.templates ?? {}));
    if (msum < MIN_LIST_MASS && !own.size) {
      const top = Array.from(pm, (p, i) => ({ label: L[i], p })).sort((a, b) => b.p - a.p).slice(0, 3);
      return { type: "unsure", top, reason: "not one of the listed signs" };
    }
    for (const l of cand) s[l] = (s[l] ?? 0) / (msum || 1);
    if (msum < MIN_LIST_MASS) for (const l of cand) if (!own.has(l)) s[l] *= msum / MIN_LIST_MASS;
    if (this.templates) {
      // a taught sign gets a boost from how closely this matches ITS recordings; it never lowers the other signs
      const z = model.standardise(x);
      for (const [l, arr] of Object.entries(T)) {
        const d = Math.min(...arr.map(a => dist(z, a)));
        const match = Math.exp(-Math.pow(d / MATCH_D0, 4));                       // ~1 for a repeat of the same sign, ~0 for another sign
        s[l] = L.includes(l) ? (s[l] ?? 0) + (1 - (s[l] ?? 0)) * 0.8 * match : 0.95 * match;
      }
    }
    const top = Object.entries(s).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label, p]) => ({ label, p }));
    const best = top[0], thr = 0.45, margin = 0.10;
    if (best.p >= thr && best.p - (top[1]?.p ?? 0) >= margin) return { type: "word", label: best.label, p: best.p, top };
    return { type: "unsure", top, reason: best.p < thr ? "low confidence" : "two signs look alike" };
  }
}
