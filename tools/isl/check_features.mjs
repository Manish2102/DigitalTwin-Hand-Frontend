// Compare js/sign/features.js with tools/isl/features.py on dumped INCLUDE videos.
import { readFileSync } from "fs";
import { anchors, frameFeatures, sequenceFeatures } from "../../js/sign/features.js";
const data = JSON.parse(readFileSync(process.argv[2], "utf8"));
const aspect = 16 / 9;
let worstF = 0, worstS = 0;
for (const v of data) {
  const frames = []; let last = null;
  for (let t = 0; t < v.hands.length; t++) {
    const pose = v.pose[t][0][0] == null ? null : v.pose[t];
    const a = anchors(pose, aspect) ?? last;
    if (!a) { frames.push({ f: new Float32Array(96) }); continue; }
    last = a;
    const hands = v.hands[t].filter(h => h[0][0] != null);
    frames.push({ f: frameFeatures(hands, pose, a, aspect) });
  }
  frames.forEach((fr, t) => fr.f.forEach((x, k) => worstF = Math.max(worstF, Math.abs(x - v.frames[t][k]))));
  const s = sequenceFeatures(frames);
  s.forEach((x, k) => worstS = Math.max(worstS, Math.abs(x - v.seq[k])));
}
console.log(`videos ${data.length}: max frame difference ${worstF.toExponential(2)}, max sequence difference ${worstS.toExponential(2)}`);
process.exit(worstF < 1e-4 && worstS < 1e-4 ? 0 : 1);
