// Replays INCLUDE test videos through the browser recogniser for the demo set, and checks a custom taught sign ("Welcome")
// that the network does not know (a different INCLUDE sign, Good afternoon, stands in for it).
//   node tools/isl/replay_demo.mjs <phrases.json> <repeats.json>
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
const reps = JSON.parse(readFileSync(process.argv[3], "utf8"));      // one person repeating a sign (simulated by augmenting one recording)
const DEMO = ["Hello", "Thank you", "How are you", "Good Morning", "I", "you", "Pleased"];
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
function run(name, rec, vids, want = v => v.label) {
  let right = 0, wrong = 0, unsure = 0, missed = 0; const bad = [];
  for (const v of vids) {
    const e = play(rec, v);
    if (!e) missed++; else if (e.type === "unsure") unsure++; else if (e.label === want(v)) right++; else { wrong++; bad.push(`${v.label}->${e.label}`); }
  }
  console.log(`${name}: ${vids.length} videos: right ${right}, wrong ${wrong}, not sure ${unsure}, nothing ${missed}${bad.length ? "  wrong: " + bad.join(", ") : ""}`);
}
const rec = new Recognizer({ words, letters }); rec.setMode("words");
const demo = data.filter(v => DEMO.includes(v.label));
rec.setSubset(DEMO); run("demo signs (no teaching)        ", rec, demo);

// teach "Welcome" (stand-in: Sunday) with 3 videos, and Thank you with 3
const sun = reps, thank = demo.filter(v => v.label === "Thank you");
const mine = { Welcome: [], "Thank you": [] };
for (const v of sun.slice(0, 3)) { rec.capture = "Welcome"; const e = play(rec, v); rec.capture = null; mine.Welcome.push(words.standardise(e.x)); }
for (const v of thank.slice(0, 3)) { rec.capture = "Thank you"; const e = play(rec, v); rec.capture = null; mine["Thank you"].push(words.standardise(e.x)); }
rec.setTemplates(mine); rec.setSubset([...DEMO, "Welcome"]);
console.log(`taught: Welcome from ${mine.Welcome.length} videos (one signer repeating a stand-in sign), Thank you from ${mine["Thank you"].length}`);
run("Welcome (held-out videos)           ", rec, sun.slice(3), () => "Welcome");
run("Thank you (held-out)                ", rec, thank.slice(3));
run("other demo signs, with Welcome added", rec, demo.filter(v => v.label !== "Thank you" || !thank.slice(0, 3).includes(v)));
{
  let said = 0; const others = data.filter(v => ["Monday", "Hospital", "Friend", "Mother", "Father", "Sunday", "Good evening", "Good night"].includes(v.label));
  for (const v of others) { const e = play(rec, v); if (e?.label === "Welcome") said++; }
  console.log(`unrelated signs: ${others.length} videos, said "Welcome" for ${said}`);
}
