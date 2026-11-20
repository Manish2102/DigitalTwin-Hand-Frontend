"""Do a person's own repeats of a sign separate from other signs? Repeats are simulated as augmented copies (noise, small
rotation / scale / trimming, like redoing the same sign) of ONE recording; "other signs" are real recordings of other signs.
    python experiment_match.py --data C:/Projects/Digital-Twin/isl-data --model ../../js/sign/models/words.json
"""
import argparse, base64, json, sys, os, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import train
from train import load_words, augment
from features import sequence_features, video_frames
ap = argparse.ArgumentParser(); ap.add_argument("--data", required=True); ap.add_argument("--model", required=True); a = ap.parse_args()
m = json.load(open(a.model)); f = lambda s: np.frombuffer(base64.b64decode(s), np.float32); mean, std = f(m["mean"]), f(m["std"])
vids = [v for v in load_words(a.data) if v["split"] == "test"]
def feats(v, k):
    out = []
    for _ in range(k):
        H, P = augment(v["hands"], v["pose"], 16 / 9, strong=False)
        s = sequence_features(video_frames(H, P, 16 / 9))
        if s is not None: out.append((s - mean) / std)
    return np.array(out)
d = lambda x, T: min(np.linalg.norm(x - t) for t in T)
rng = np.random.default_rng(5); rows = []
cands = [v for v in vids if v["label"] in ("Good afternoon", "Thank you", "Hello", "Mother")]
for v in cands:
    R = feats(v, 9)
    if len(R) < 8: continue
    T, held = R[:3], R[3:]
    within = [min(np.linalg.norm(T[i] - T[j]) for j in range(3) if j != i) for i in range(3)]; tau = float(np.mean(within))
    own = [d(x, T) for x in held]
    others = [d((feats(o, 1)[0] if len(feats(o, 1)) else None), T) for o in vids if o["label"] != v["label"] and len(feats(o, 1))]
    d0 = min(22.0, max(14.0, 1.3 * tau)); match = lambda dd: float(np.exp(-(dd / d0) ** 4))
    rows.append((v["label"], tau, np.mean([match(x) for x in own]), np.min([match(x) for x in own]), np.max([match(x) for x in others]), np.mean([match(x) > 0.5 for x in others])))
    print(f"{v['label']:15s} tau {tau:5.1f} d0 {d0:4.1f}  own repeats match mean {rows[-1][2]:.2f} min {rows[-1][3]:.2f} | other signs match max {rows[-1][4]:.2f}, share above 0.5: {rows[-1][5]:.1%}  (distance own {np.mean(own):.1f} vs other {np.min(others):.1f}..{np.median(others):.1f})")
