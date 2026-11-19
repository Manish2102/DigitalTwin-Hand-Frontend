// Run js/sign/model.js on the same inputs as check_model.py and compare the probabilities.
import { readFileSync } from "fs";
const [, , modelPath, dataPath] = process.argv;
globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(readFileSync(modelPath, "utf8")) });
globalThis.atob ??= s => Buffer.from(s, "base64").toString("binary");
const { loadModel } = await import("../../js/sign/model.js");
const m = await loadModel("x"), d = JSON.parse(readFileSync(dataPath, "utf8"));
let worst = 0, agree = 0, right = 0;
d.X.forEach((x, i) => {
  const p = m.predict(Float32Array.from(x));
  p.forEach((v, k) => worst = Math.max(worst, Math.abs(v - d.P[i][k])));
  const a = p.indexOf(Math.max(...p)), b = d.P[i].indexOf(Math.max(...d.P[i]));
  agree += a === b; right += a === d.Y[i];
});
console.log(`js: accuracy ${(right / d.X.length).toFixed(3)}, same answer as numpy ${agree}/${d.X.length}, max probability difference ${worst.toExponential(2)}`);
process.exit(worst < 1e-4 && agree === d.X.length ? 0 : 1);
