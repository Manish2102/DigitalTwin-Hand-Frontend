// Replays the phrase test videos through the browser recogniser in three set-ups:
//   all 106 words / the 17 presentation phrases / "my signs" (2 videos per phrase recorded as the user's samples)
//   node tools/isl/replay_phrases.mjs <phrases.json>
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
const PHRASES = [...new Set(data.map(v => v.label))];
const fix = a => a.map(p => p.map(v => v ?? NaN));
let T = 0;
function play(rec, v) {
  const events = [];
  const frame = (hands, pose) => { const e = rec.push({ hands, pose, aspect: 16 / 9 }, T); T += 40; if (e) events.push(e); };
  for (let i = 0; i < v.hands.length; i++) frame(v.hands[i].filter(h => h[0][0] != null).map(fix), v.pose[i][0][0] == null ? null : fix(v.pose[i]));
  const last = v.pose[v.pose.length - 1][0][0] == null ? null : fix(v.pose[v.pose.length - 1]);
  for (let k = 0; k < 15; k++) frame([], last);
  return events.filter(x => ["word", "unsure", "sample"].includes(x.type)).pop();
}
function run(name, rec, vids) {
  let right = 0, wrong = 0, unsure = 0, missed = 0; const bad = [];
  for (const v of vids) {
    const e = play(rec, v);
    if (!e) missed++; else if (e.type === "unsure") unsure++; else if (e.label === v.label) right++; else { wrong++; bad.push(`${v.label}->${e.label}`); }
  }
  const n = vids.length;
  console.log(`${name}: ${n} videos: right ${right}, wrong ${wrong}, not sure ${unsure}, nothing ${missed}; answered ${right + wrong} (${((right / Math.max(1, right + wrong)) * 100).toFixed(0)}% right)${bad.length ? "  wrong: " + bad.join(", ") : ""}`);
}
const rec = new Recognizer({ words, letters }); rec.setMode("words");
run("all 106 words        ", rec, data);
rec.setSubset(PHRASES); run("presentation phrases ", rec, data);
// teach: first 3 videos of each phrase are "my recordings" (recorded through the same capture path), the rest are tested
const mine = {}, test = [];
for (const l of PHRASES) {
  const vs = data.filter(v => v.label === l), k = vs.length >= 4 ? 3 : Math.max(1, vs.length - 1);
  vs.slice(0, k).forEach(v => { rec.capture = l; const e = play(rec, v); rec.capture = null; if (e?.type === "sample") (mine[l] ??= []).push(words.standardise(e.x)); });
  test.push(...vs.slice(k));
}
const taught = Object.keys(mine).filter(l => mine[l].length >= 2);
rec.setSubset(taught); rec.setTemplates(Object.fromEntries(taught.map(l => [l, mine[l]])));
run(`my signs (${taught.length} taught)`, rec, test.filter(v => taught.includes(v.label)));
rec.setTemplates(null); run("   same videos, no templates", rec, test.filter(v => taught.includes(v.label)));
const CORE = ["Hello", "How are you", "Thank you", "Good Morning", "Good afternoon", "Pleased", "I", "you", "Friend", "Mother", "Father", "Today", "Tomorrow"];
rec.setSubset(CORE); run("core 13 phrases       ", rec, data.filter(v => CORE.includes(v.label)));
