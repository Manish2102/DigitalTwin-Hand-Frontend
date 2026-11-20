// avatar.js - the "avatar pulls the slide" transition for GestureDeck.
//
// A big-headed cartoon presenter, wearing the face you chose, sprints in from the side, skids to a stop at the slide,
// grabs its edge, grunts "HEAVE!" and hauls the slide away with a lot of effort (sweat, dust, a wobbling head) while the
// next slide zooms up from underneath. Next slide: it comes in from the left and drags the slide off to the left;
// previous slide: the other way round.
// You can add as many faces as you like; each swipe uses the next face, so every face gets its turn once before any repeats
// (in the order added, or shuffled). With one face, it is always that face.
// Pure DOM + SVG + the Web Animations API, no library. Faces are only stored in this browser (localStorage).

const NS = "http://www.w3.org/2000/svg";
const PHRASES = ["HEAVE!", "Pulling harder!", "Help me!", "So heavy!", "Almost there!", "Ugh... one more!", "My back!", "Come ON!"];
const AR = 160 / 250;                       // avatar width / height (the SVG viewBox is 160 x 250)
const FACES_KEY = "dtl.deckFaces", OLD_KEYS = ["dtl.deckFaceL", "dtl.deckFaceR", "dtl.deckFace"], MAX_FACES = 12;

const get = k => { try { return localStorage.getItem(k) || null; } catch { return null; } };
const put = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} };
export function loadFaces() {
  let list = [];
  try { list = JSON.parse(get(FACES_KEY) || "[]"); } catch {}
  for (const k of OLD_KEYS) { const v = get(k); if (v) { if (!list.includes(v)) list.push(v); put(k, null); } }   // faces saved by earlier versions
  return list.filter(x => typeof x === "string").slice(0, MAX_FACES);
}

// centre-cropped square, 240 px, as a JPEG data URL
function squareFrom(src, w, h, mirror) {
  const s = Math.min(w, h), cv = document.createElement("canvas");
  cv.width = cv.height = 240;
  const c = cv.getContext("2d");
  if (mirror) { c.translate(240, 0); c.scale(-1, 1); }
  c.drawImage(src, (w - s) / 2, (h - s) / 2, s, s, 0, 0, 240, 240);
  return cv.toDataURL("image/jpeg", 0.88);
}
export async function faceFromFile(file) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file (JPG or PNG).");
  const bmp = await createImageBitmap(file);
  try { return squareFrom(bmp, bmp.width, bmp.height, false); } finally { bmp.close?.(); }
}
export function faceFromVideo(video) {
  if (!video || video.readyState < 2 || !video.videoWidth) throw new Error("The camera is not showing a picture yet.");
  return squareFrom(video, video.videoWidth, video.videoHeight, true);
}

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.appendChild(e);
  return e;
}

// The presenter, drawn facing right. CSS (index.html) bobs the body, swings legs and arms and wobbles the head while .walk is set.
export function buildAvatarSvg(face) {
  const svg = el("svg", { viewBox: "0 0 160 250", class: "av-svg", "aria-hidden": "true" });
  const defs = el("defs", {}, svg);
  el("circle", { cx: 80, cy: 62, r: 50 }, el("clipPath", { id: "dkAvClip" }, defs));
  el("ellipse", { cx: 80, cy: 243, rx: 52, ry: 6, fill: "rgba(0,0,0,.35)" }, svg);
  const flip = el("g", { class: "av-flip" }, svg);
  const bob = el("g", { class: "av-bob" }, flip);
  const legs = el("g", { class: "av-legs" }, bob);
  for (const side of ["a", "b"]) {                            // short legs, huge clown shoes
    const g = el("g", { class: `av-leg av-leg-${side}` }, legs);
    el("line", { x1: 80, y1: 168, x2: 80, y2: 222, stroke: "#2b3245", "stroke-width": 15, "stroke-linecap": "round" }, g);
    el("ellipse", { cx: 92, cy: 233, rx: 22, ry: 10, fill: "#ff5d73" }, g);
    el("ellipse", { cx: 96, cy: 229, rx: 12, ry: 4, fill: "rgba(255,255,255,.55)" }, g);
  }
  const up = el("g", { class: "av-up" }, bob);
  el("rect", { x: 46, y: 104, width: 68, height: 76, rx: 28, fill: "#ffb020" }, up);       // chubby hoodie
  el("rect", { x: 46, y: 150, width: 68, height: 30, rx: 12, fill: "#f09400" }, up);
  el("path", { d: "M62 108 Q80 124 98 108", fill: "none", stroke: "#f09400", "stroke-width": 6, "stroke-linecap": "round" }, up);
  for (const side of ["a", "b"]) {                            // noodle arms with big gloves
    const g = el("g", { class: `av-arm av-arm-${side}` }, up);
    el("line", { x1: 80, y1: 122, x2: 80, y2: 176, stroke: side === "a" ? "#ffb020" : "#f09400", "stroke-width": 14, "stroke-linecap": "round" }, g);
    el("circle", { cx: 80, cy: 181, r: 11, fill: "#fff", stroke: "#d6dbe6", "stroke-width": 2 }, g);
  }
  const head = el("g", { class: "av-head" }, up);            // BIG head, wobbles on a thin neck
  el("rect", { x: 73, y: 100, width: 14, height: 18, rx: 6, fill: "#f2c9a0" }, head);
  if (face) {
    el("circle", { cx: 80, cy: 62, r: 54, fill: "#fff" }, head);
    const im = el("image", { x: 30, y: 12, width: 100, height: 100, preserveAspectRatio: "xMidYMid slice", "clip-path": "url(#dkAvClip)" }, head);
    im.setAttributeNS("http://www.w3.org/1999/xlink", "href", face); im.setAttribute("href", face);
    el("circle", { cx: 80, cy: 62, r: 50, fill: "none", stroke: "#fff", "stroke-width": 4 }, head);
  } else {                                                    // no photo yet: a goofy default face
    el("circle", { cx: 80, cy: 62, r: 50, fill: "#f2c9a0", stroke: "#fff", "stroke-width": 4 }, head);
    el("circle", { cx: 64, cy: 54, r: 11, fill: "#fff" }, head); el("circle", { cx: 98, cy: 54, r: 11, fill: "#fff" }, head);
    el("circle", { cx: 67, cy: 56, r: 5, fill: "#2b3245" }, head); el("circle", { cx: 95, cy: 56, r: 5, fill: "#2b3245" }, head);
    el("path", { d: "M56 80 Q80 102 104 80 Z", fill: "#8a2b3b", stroke: "#2b3245", "stroke-width": 3, "stroke-linejoin": "round" }, head);
  }
  const sweat = el("g", { class: "av-sweat" }, head);         // shown while pulling
  for (const [x, y] of [[132, 28], [140, 52], [24, 36]]) el("path", { d: `M${x} ${y} q-6 10 0 14 q6 -4 0 -14`, fill: "#6ec6ff" }, sweat);
  return svg;
}

export class Avatar {
  constructor(stage) {
    this.stage = stage; this.faces = loadFaces(); this.bag = []; this.last = -1;
    this.layer = document.createElement("div"); this.layer.className = "dk-av-layer";
    stage.appendChild(this.layer);
    this.anims = []; this.done = null; this.timers = []; this.phrase = 0; this.turn = 0;
    this.save();
  }
  save() { put(FACES_KEY, this.faces.length ? JSON.stringify(this.faces) : null); }
  addFace(url) {
    if (this.faces.length >= MAX_FACES) throw new Error(`You can keep up to ${MAX_FACES} faces. Remove one first.`);
    this.faces.push(url); this.bag = []; this.save();
  }
  removeFace(i) { this.faces.splice(i, 1); this.bag = []; this.save(); }
  // The face for the next pull: each face comes once before any repeats. shuffle: a random order each round
  // (never the same face twice in a row); otherwise the order they were added.
  nextFace(shuffle = false) {
    const n = this.faces.length;
    if (!n) return null;
    if (!shuffle) return this.faces[this.turn++ % n];
    if (!this.bag.length) {
      this.bag = [...this.faces.keys()].sort(() => Math.random() - 0.5);
      if (n > 1 && this.bag[this.bag.length - 1] === this.last) this.bag.unshift(this.bag.pop());      // draw from the end
    }
    this.last = this.bag.pop();
    return this.faces[this.last];
  }
  get busy() { return this.anims.length > 0; }

  // stop at once: the slide and the avatar are removed, the caller tidies the slide layer
  cancel() {
    for (const a of this.anims) { try { a.cancel(); } catch {} }
    for (const t of this.timers) { clearTimeout(t); clearInterval(t); }
    this.anims = []; this.timers = []; this.layer.replaceChildren(); this.done?.(); this.done = null;
  }

  dust(x, y, dirX) {                                           // a small cloud kicked up by the shoes
    const d = document.createElement("i"); d.className = "av-dust";
    d.style.cssText = `left:${x}px;top:${y}px`;
    this.layer.appendChild(d);
    const a = d.animate([{ transform: "translate(0,0) scale(.4)", opacity: .75 }, { transform: `translate(${dirX * 26}px,-18px) scale(1.5)`, opacity: 0 }], { duration: 520, easing: "ease-out" });
    a.onfinish = () => d.remove();
  }

  // oldEl: the layer holding the slide that leaves. underEl: the layer with the next slide (zooms up). dir: "next" or "prev".
  // face: the picture (data URL) for the head; none = the default goofy face.
  pull(oldEl, dir, { underEl = null, face = null } = {}) {
    this.cancel();
    const sr = this.stage.getBoundingClientRect(), W = sr.width, H = sr.height;
    const frame = oldEl.querySelector(".dk-frame")?.getBoundingClientRect();
    if (!frame || !W) return Promise.resolve();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const L0 = frame.left - sr.left, R0 = frame.right - sr.left;
    const ah = Math.max(170, Math.min(390, H * 0.52)), aw = ah * AR;
    const next = dir === "next";                                        // next: the slide leaves to the left
    const bottom = Math.max(6, H * 0.03);
    const holder = document.createElement("div"); holder.className = "dk-av";
    holder.style.cssText = `width:${aw}px;height:${ah}px;bottom:${bottom}px;left:0;transform-origin:50% 100%`;
    const svg = buildAvatarSvg(face);
    holder.appendChild(svg);
    const bubble = document.createElement("b"); bubble.className = "av-bubble"; bubble.textContent = "HUP!";
    holder.appendChild(bubble);
    this.layer.appendChild(holder);
    const stand = next ? Math.max(L0 - aw * 0.5, 14) : Math.min(R0 - aw * 0.5, W - aw - 14);   // where it grabs the slide (always fully in view)
    const start = next ? Math.min(-aw * 1.3, stand - aw * 2.6) : Math.max(W + aw * 0.3, stand + aw * 2.6);
    const D = (next ? R0 : W - L0) + aw + 60;                           // how far until slide and avatar are gone
    const end = next ? stand - D : stand + D;
    const over = (next ? 1 : -1) * aw * 0.18;                           // overshoot when it skids to a stop
    const T = reduce ? 900 : 4800, easeIn = "cubic-bezier(.4,0,.7,.8)";
    const sign = next ? 1 : -1;                                          // +1: the runner comes in facing right

    const a1 = holder.animate([
      { transform: `translateX(${start}px)`, offset: 0, easing: "cubic-bezier(.15,.75,.35,1)" },
      { transform: `translateX(${stand + over}px)`, offset: 0.26, easing: "ease-in-out" },     // skid past the edge...
      { transform: `translateX(${stand}px)`, offset: 0.34 },                                    // ...and back to it
      { transform: `translateX(${stand}px)`, offset: 0.44, easing: easeIn },
      { transform: `translateX(${end}px)`, offset: 1 },
    ], { duration: T, fill: "forwards" });
    const a2 = svg.animate([                                             // run in facing the slide, turn at the edge, pull facing away
      { transform: `scaleX(${sign})`, offset: 0 }, { transform: `scaleX(${sign})`, offset: 0.36 },
      { transform: `scaleX(${-sign})`, offset: 0.40 }, { transform: `scaleX(${-sign})`, offset: 1 },
    ], { duration: T, fill: "forwards", easing: "steps(1,end)" });
    const sq = holder.animate([                                          // squash and stretch: skid, grab, heave
      { transform: "scale(1,1)", offset: 0 }, { transform: "scale(1.12,.9)", offset: 0.27 },
      { transform: "scale(.95,1.07)", offset: 0.36 }, { transform: "scale(1.08,.94)", offset: 0.46 }, { transform: "scale(1,1)", offset: 0.6 },
    ], { duration: T, composite: "add" });
    const tug = (next ? -1 : 1) * 16;
    const a3 = oldEl.animate([
      { transform: "translateX(0) rotate(0)", offset: 0 }, { transform: "translateX(0) rotate(0)", offset: 0.38 },
      { transform: `translateX(${tug}px) rotate(${-tug / 70}deg)`, offset: 0.45, easing: easeIn },                  // the first tug
      { transform: `translateX(${tug * 0.4}px) rotate(${-tug / 140}deg)`, offset: 0.5, easing: easeIn },              // it springs back a little
      { transform: `translateX(${next ? -D : D}px) rotate(${next ? -4 : 4}deg)`, offset: 1 },
    ], { duration: T, fill: "forwards", easing: "linear" });
    this.anims = [a1, a2, sq, a3];
    if (underEl) {                                                       // the next slide zooms up as it is uncovered
      this.anims.push(underEl.animate([{ transform: "scale(.9)", filter: "brightness(.7)", offset: 0 }, { transform: "scale(.9)", filter: "brightness(.7)", offset: 0.44 },
        { transform: "scale(1)", filter: "brightness(1)", offset: 1 }], { duration: T, easing: "cubic-bezier(.2,.8,.3,1)" }));
    }
    holder.classList.add("walk");
    const later = (ms, fn) => this.timers.push(setTimeout(fn, ms));
    later(T * 0.36, () => holder.classList.add("pull"));
    // it shouts while it pulls: a new phrase every ~0.7 s (it carries on from where the last swipe stopped), one after another, repeating
    const speak = () => {
      bubble.classList.remove("show");
      setTimeout(() => { bubble.textContent = PHRASES[this.phrase++ % PHRASES.length]; bubble.classList.add("show"); }, 120);
    };
    later(T * 0.12, () => { bubble.textContent = "HUP!"; bubble.classList.add("show"); });
    later(T * 0.3, () => bubble.classList.remove("show"));
    later(T * 0.46, () => { speak(); this.timers.push(setInterval(speak, 720)); });
    later(T * 0.94, () => bubble.classList.remove("show"));
    // dust behind the shoes while it runs and pulls
    const iv = setInterval(() => {
      const r = holder.getBoundingClientRect(), s = this.layer.getBoundingClientRect();
      if (r.width) this.dust((r.left + r.width / 2) - s.left, (r.bottom - s.top) - 14, next ? (holder.classList.contains("pull") ? 1 : -1) : (holder.classList.contains("pull") ? -1 : 1));
    }, 120);
    this.timers.push(iv);
    return new Promise(res => {
      this.done = res;
      a3.onfinish = () => { for (const a of this.anims) { try { a.cancel(); } catch {} } for (const t of this.timers) { clearTimeout(t); clearInterval(t); } this.anims = []; this.timers = []; this.layer.replaceChildren(); this.done = null; res(); };   // cancel: do not keep the end position
    });
  }
}
