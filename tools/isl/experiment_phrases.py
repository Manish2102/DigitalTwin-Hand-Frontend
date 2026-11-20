"""How much does restricting to a small phrase list, and personal templates, help? (INCLUDE test split, numpy only)
    python experiment_phrases.py --data C:/Projects/Digital-Twin/isl-data --model ../../js/sign/models/words.json
"""
import argparse, base64, json, sys, os, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from train import load_words, word_xy

PHRASES = ["Hello", "How are you", "Thank you", "Good Morning", "Good afternoon", "Pleased", "I", "you", "Friend", "Mother", "Father", "Today", "Tomorrow"]
           "I", "you", "Friend", "Mother", "Father", "Brother", "Sister", "Today", "Tomorrow"]
ap = argparse.ArgumentParser(); ap.add_argument("--data", required=True); ap.add_argument("--model", required=True); a = ap.parse_args()
m = json.load(open(a.model)); f = lambda s: np.frombuffer(base64.b64decode(s), np.float32)
labels = m["labels"]; mean, std = f(m["mean"]), f(m["std"])
def probs(X):
    z = (X - mean) / std
    for k, l in enumerate(m["layers"]):
        z = z @ f(l["w"]).reshape(l["rows"], l["cols"]).T + f(l["b"])
        if k < len(m["layers"]) - 1: z = np.maximum(z, 0)
    z = z / m["temperature"]; z -= z.max(1, keepdims=True); P = np.exp(z); return P / P.sum(1, keepdims=True)
vids = [v for v in load_words(a.data) if v["split"] == "test" and v["label"] in PHRASES]
X, Y = word_xy(vids, labels); P = probs(X)
idx = [labels.index(p) for p in PHRASES]
Ps = P[:, idx]; Ys = np.array([idx.index(y) for y in Y])
print(f"{len(Y)} test videos of the {len(PHRASES)} phrases")
print("full 106-word model, top-1:", (P.argmax(1) == Y).mean().round(3))
Pr = Ps / Ps.sum(1, keepdims=True)
print("restricted to the phrases, top-1:", (Pr.argmax(1) == Ys).mean().round(3), " top-3:", np.mean([y in np.argsort(-p)[:3] for p, y in zip(Pr, Ys)]).round(3))
# personal templates: 3 recordings per phrase as "my samples" (same split, other videos tested); repeat over random draws
Z = (X - mean) / std; rng = np.random.default_rng(1); accs = {"model": [], "tmpl": [], "blend": []}
for rep in range(30):
    tmpl, test = [], []
    for c in range(len(PHRASES)):
        ii = np.where(Ys == c)[0]; rng.shuffle(ii); k = 2 if len(ii) >= 3 else 1; tmpl += list(ii[:k]); test += list(ii[k:])
    T = Z[tmpl]; TY = Ys[tmpl]
    within = []
    for c in range(len(PHRASES)):
        t = T[TY == c]
        for i in range(len(t)): within.append(min([np.linalg.norm(t[i] - t[j]) for j in range(len(t)) if j != i] or [np.nan]))
    tau = np.nanmean(within)
    ok = {"model": 0, "tmpl": 0, "blend": 0}
    for i in test:
        d = np.array([min([np.linalg.norm(Z[i] - t) for t in T[TY == c]] or [1e9]) for c in range(len(PHRASES))])
        q = np.exp(-(d - d.min()) / tau); q /= q.sum()
        b = 0.5 * Pr[i] + 0.5 * q
        ok["model"] += Pr[i].argmax() == Ys[i]; ok["tmpl"] += q.argmax() == Ys[i]; ok["blend"] += b.argmax() == Ys[i]
    for k in ok: accs[k].append(ok[k] / len(test))
print("with 2 personal samples per phrase (cross-signer, so pessimistic):", {k: round(float(np.mean(v)), 3) for k, v in accs.items()})
srt = np.sort(Pr, 1)
for thr, mg in [(0.57, 0.12), (0.45, 0.10), (0.40, 0.08), (0.35, 0.06)]:
    ok = (Pr.max(1) >= thr) & (srt[:, -1] - srt[:, -2] >= mg)
    print(f"restricted, threshold {thr} margin {mg}: answers {ok.mean():.0%}, right {(Pr.argmax(1)[ok] == Ys[ok]).mean():.0%}")
