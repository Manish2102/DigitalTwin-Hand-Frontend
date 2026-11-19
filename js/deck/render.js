// render.js - opens a presentation file in the browser and hands out slides ready to show.
//
//   const deck = await openDeck(file, (fraction, text) => ...);
//   deck.count, deck.aspect, deck.kind ("pptx" | "pdf"), deck.warnings
//   const el = await deck.slide(i, widthPx, heightPx);   // an element to put on the stage (cached)
//   const el = await deck.thumb(i);                       // a small version for the slide list
//   deck.destroy();
//
// .pptx: parsed and drawn as SVG by Pagus (MIT, client-side). Embedded fonts are registered with the browser;
//        other fonts are mapped to close Google Fonts. Animations, transitions, audio and video are not played.
// .pdf:  drawn by pdf.js at the screen's resolution, so it looks exactly like the original.
// .ppt (PowerPoint 97-2003): cannot be opened in a browser; the error says how to convert it.
// Nothing is uploaded: the file is read in this browser only.

const PAGUS = "https://cdn.jsdelivr.net/npm/@pagus-kit/core@0.1.1/+esm";
const PAGUS_R = "https://cdn.jsdelivr.net/npm/@pagus-kit/renderer@0.1.1/+esm";
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
import { loadEmbeddedFonts } from "./fonts.js";
export const MAX_BYTES = 200 * 1024 * 1024;

export class DeckError extends Error {
  constructor(message, hint) { super(message); this.hint = hint; }
}

export async function sniff(file) {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const hex = [...head].map(b => b.toString(16).padStart(2, "0")).join("");
  if (hex.startsWith("504b0304")) return "zip";
  if (hex.startsWith("25504446")) return "pdf";                     // %PDF
  if (hex.startsWith("d0cf11e0a1b11ae1")) return "ole";             // PowerPoint 97-2003 .ppt (and other old Office files)
  return "unknown";
}

export async function openDeck(file, progress = () => {}) {
  if (!file) throw new DeckError("No file chosen.");
  if (file.size === 0) throw new DeckError("This file is empty.");
  if (file.size > MAX_BYTES) throw new DeckError(`This file is ${(file.size / 1048576).toFixed(0)} MB. The limit is 200 MB.`,
    "Compress the pictures in PowerPoint (File, Compress Pictures), or export to PDF.");
  const kind = await sniff(file);
  if (kind === "ole") throw new DeckError("This is an older PowerPoint 97-2003 file (.ppt), which browsers cannot open.",
    "In PowerPoint, choose File, Save As, and pick PowerPoint Presentation (.pptx), or File, Export, PDF. Then open the new file here.");
  if (kind === "pdf") return openPdf(file, progress);
  if (kind === "zip") return openPptx(file, progress);
  throw new DeckError("This is not a PowerPoint (.pptx) or PDF file.", "Choose a .pptx or .pdf file.");
}

// ------------------------------------------------------------------- PPTX
let pagusLib = null;

async function openPptx(file, progress) {
  progress(0.05, "Loading the PowerPoint reader...");
  pagusLib ??= Promise.all([import(PAGUS), import(PAGUS_R)]);
  let core, R;
  try { [core, R] = await pagusLib; }
  catch { pagusLib = null; throw new DeckError("Could not load the PowerPoint reader.", "It needs internet access to cdn.jsdelivr.net the first time."); }
  progress(0.15, "Reading the slides...");
  let pres;
  const buf = await file.arrayBuffer();
  try { pres = await core.parse(buf.slice(0)); }
  catch (e) {
    throw new DeckError("This file could not be read as a PowerPoint presentation.",
      "It may be damaged or password-protected. Open it in PowerPoint and save it again, or export it to PDF.");
  }
  if (!pres?.slides?.length) throw new DeckError("This presentation has no slides.");
  const warnings = [];
  progress(0.3, "Loading fonts...");
  await loadFonts(pres, R, warnings, buf);

  // draw every slide once now, so nothing can fail or stall later in front of an audience
  const svgs = [];
  for (let i = 0; i < pres.slides.length; i++) {
    try { svgs.push(R.renderSlide(pres.slides[i], pres.slideSize).svg); }
    catch (e) { svgs.push(null); warnings.push(`Slide ${i + 1} could not be drawn and shows a placeholder.`); }
    if (i % 4 === 0) { progress(0.4 + 0.55 * i / pres.slides.length, `Preparing slide ${i + 1} of ${pres.slides.length}...`); await idle(); }
  }
  const { width, height } = pres.slideSize;
  const cache = new Map();
  const make = i => {
    const holder = document.createElement("div");
    holder.className = "deck-svg";
    if (svgs[i]) holder.innerHTML = svgs[i];
    else holder.innerHTML = placeholder(i, width, height);
    const svg = holder.querySelector("svg");
    if (svg) { svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%"); svg.setAttribute("preserveAspectRatio", "xMidYMid meet"); }
    return holder;
  };
  progress(1, "Ready");
  return {
    kind: "pptx", name: file.name, count: pres.slides.length, aspect: width / height, warnings,
    async slide(i) { if (!cache.has(i)) cache.set(i, make(i)); return cache.get(i); },
    async thumb(i) { return make(i); },
    destroy() { cache.clear(); },
  };
}

async function loadFonts(pres, R, warnings, buf) {
  const f = pres.fonts ?? {};
  const jobs = [loadEmbeddedFonts(buf).then(r => {                // fonts saved inside the .pptx
    if (r.skipped.length) warnings.push(`Embedded fonts that could not be used (a similar font is used): ${r.skipped.join(", ")}.`);
    return r;
  })];
  try {                                                           // close Google Fonts for well-known fonts
    const { css, unresolvedFonts } = R.generateFontCss(f) ?? {};
    if (css && !document.querySelector(`style[data-deck-fonts="${btoa(unescape(encodeURIComponent(css))).slice(0, 40)}"]`)) {
      const st = document.createElement("style");
      st.dataset.deckFonts = btoa(unescape(encodeURIComponent(css))).slice(0, 40);
      st.textContent = css; document.head.appendChild(st);
    }
    const embedded = new Set((f.embeddedFonts ?? []).map(e => e.familyName));
    const missing = (unresolvedFonts ?? []).filter(n => !n.startsWith("+") && !embedded.has(n) && !document.fonts.check(`12px "${n}"`));
    if (missing.length) warnings.push(`Fonts not available in the browser (a similar font is used): ${missing.join(", ")}.`);
  } catch {}
  await Promise.race([Promise.all(jobs).then(() => document.fonts.ready), new Promise(r => setTimeout(r, 4000))]);
}

function placeholder(i, w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#f4f5f7"/>
    <text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-family="Inter, sans-serif" font-size="${h / 20}" fill="#6b7280">Slide ${i + 1} could not be shown</text></svg>`;
}

// -------------------------------------------------------------------- PDF
let pdfLib = null;

async function openPdf(file, progress) {
  progress(0.05, "Loading the PDF reader...");
  try {
    pdfLib ??= import(PDFJS).then(m => { m.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; return m; });
    var pdfjs = await pdfLib;
  } catch { pdfLib = null; throw new DeckError("Could not load the PDF reader.", "It needs internet access to cdn.jsdelivr.net the first time."); }
  let doc;
  try { doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; }
  catch (e) {
    if (e?.name === "PasswordException") throw new DeckError("This PDF is password-protected.", "Save a copy without a password and open that.");
    throw new DeckError("This PDF could not be read.", "It may be damaged. Export it from PowerPoint again.");
  }
  const first = await doc.getPage(1), vp = first.getViewport({ scale: 1 });
  const cache = new Map();                                       // key: page@width
  const order = [];
  async function draw(i, w) {
    const key = `${i}@${w}`;
    if (cache.has(key)) return cache.get(key);
    const job = (async () => {
      const page = await doc.getPage(i + 1);
      const v1 = page.getViewport({ scale: 1 }), scale = w / v1.width, v = page.getViewport({ scale });
      const c = document.createElement("canvas");
      c.width = Math.round(v.width); c.height = Math.round(v.height); c.className = "deck-canvas";
      await page.render({ canvasContext: c.getContext("2d"), viewport: v }).promise;
      return c;
    })();
    cache.set(key, job); order.push(key);
    while (order.length > 24) cache.delete(order.shift());       // keep memory bounded on long decks
    try { return await job; } catch (e) { cache.delete(key); throw e; }
  }
  progress(1, "Ready");
  return {
    kind: "pdf", name: file.name, count: doc.numPages, aspect: vp.width / vp.height, warnings: [],
    async slide(i, w) {
      const width = Math.min(3840, Math.max(320, Math.round((w || 1280) * (window.devicePixelRatio || 1)) & ~63));
      const c = await draw(i, width);
      for (const n of [i + 1, i - 1]) if (n >= 0 && n < doc.numPages) draw(n, width).catch(() => {});   // the next one is ready before you need it
      return c;
    },
    async thumb(i) { const c = await draw(i, 320); const t = document.createElement("canvas"); t.width = c.width; t.height = c.height; t.getContext("2d").drawImage(c, 0, 0); return t; },
    destroy() { cache.clear(); doc.destroy(); },
  };
}

const idle = () => new Promise(r => setTimeout(r, 0));
