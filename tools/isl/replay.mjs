// End-to-end replay: feeds held-out ISL recordings frame by frame through the browser recogniser
// (js/sign/recognizer.js -> features.js -> model.js), with real timing, and checks what it writes.
//   node tools/isl/replay.mjs <replay.json>      (made by dump_replay.py from INCLUDE test videos and unseen-signer letters)
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const here = dirname(fileURLToPath(import.meta.url));
globalThis.atob ??= s => Buffer.from(s, "base64").toString("binary");
globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(readFileSync(url instanceof URL ? url : join(here, "../../js/sign/models", String(url)), "utf8")) });
const { loadModel } = await import("../../js/sign/model.js");
const { Recognizer } = await import("../../js/sign/recognizer.js");
const words = await loadModel("words.json"), letters = await loadModel("letters.json");
const data = JSON.parse(readFileSync(process.argv[2], "utf8"));
const fix = a => a.map(p => p.map(v => v ?? NaN));

// ---- words: each test video, with its own rest before and after, played at 25 fps; then 0.6 s of rest
const rec = new Recognizer({ words, letters }); rec.setMode("words");
let t = 0, right = 0, wrong = 0, unsure = 0, missed = 0, unsureHadIt = 0;
const wrongs = [];
for (const v of data.words) {
  const events = [];
  const frame = (hands, pose) => { const e = rec.push({ hands, pose, aspect: 16 / 9 }, t); t += 40; if (e) events.push(e); };
  for (let i = 0; i < v.hands.length; i++) {
    const hands = v.hands[i].filter(h => h[0][0] != null).map(fix);
    const pose = v.pose[i][0][0] == null ? null : fix(v.pose[i]);
    frame(hands, pose);
  }
  const last = v.pose[v.pose.length - 1][0][0] == null ? null : fix(v.pose[v.pose.length - 1]);
  for (let k = 0; k < 15; k++) frame([], last);                       // hands down / out of view
  const e = events.filter(x => x.type === "word" || x.type === "unsure");
  if (!e.length) { missed++; continue; }
  const r = e[e.length - 1];
  if (r.type === "word") { if (r.label === v.label) right++; else { wrong++; wrongs.push(`${v.label} -> ${r.label} (${Math.round(r.p * 100)}%)`); } }
  else { unsure++; if (r.top.some(x => x.label === v.label)) unsureHadIt++; }
}
const n = data.words.length;
console.log(`WORDS  ${n} test videos: correct ${right}, wrong ${wrong}, "not sure" ${unsure} (right answer among its 3 suggestions in ${unsureHadIt}), nothing detected ${missed}`);
console.log(`       answers given: ${right + wrong}, of which correct ${((right / Math.max(1, right + wrong)) * 100).toFixed(1)}%`);
if (wrongs.length) console.log(`       wrong: ${wrongs.join("; ")}`);

// ---- letters: each unseen-signer image held for 1.2 s (30 fps with small jitter), then hands down for 1.2 s
const rl = new Recognizer({ words, letters }); rl.setMode("letters");
let lr = 0, lw = 0, lm = 0; const lwrong = []; t = 0;
for (const it of data.letters) {
  const hands = it.hands.filter(h => h[0][0] != null).map(fix), pose = it.pose[0][0] == null ? null : fix(it.pose);
  const got = [];
  for (let k = 0; k < 36; k++) {
    const jit = hands.map(h => h.map(p => [p[0] + (Math.random() - 0.5) * 0.004, p[1] + (Math.random() - 0.5) * 0.004, p[2]]));
    const e = rl.push({ hands: jit, pose, aspect: it.aspect }, t); t += 33; if (e?.type === "letter") got.push(e);
  }
  for (let k = 0; k < 36; k++) { rl.push({ hands: [], pose, aspect: it.aspect }, t); t += 33; }
  if (!got.length) lm++;
  else if (got[0].label === it.label || (["O", "0"].includes(it.label) && ["O", "0"].includes(got[0].label))) lr++;
  else { lw++; lwrong.push(`${it.label}->${got[0].label}`); }
}
const nl = data.letters.length;
console.log(`LETTERS ${nl} unseen-signer images held 1.2 s: correct ${lr}, wrong ${lw}, held back as not sure ${lm}; answers correct ${((lr / Math.max(1, lr + lw)) * 100).toFixed(1)}%`);
if (lwrong.length) console.log(`       wrong: ${lwrong.join(", ")}`);
