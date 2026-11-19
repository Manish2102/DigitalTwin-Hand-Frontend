"""Letters: do depth (z) and cross-hand features help on unseen signers?"""
import os, sys, math, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from train import load_letters
from features import anchors, frame_features, R_WR, L_WR
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.neural_network import MLPClassifier

TIPS = [4, 8, 12, 16, 20]


def slots_of(H, P, asp):
    valid = [h for h in H if np.isfinite(h[0][0])]
    wr = [P[R_WR], P[L_WR]]
    d = lambda h, k: math.hypot((h[0][0] - wr[k][0]) * asp, h[0][1] - wr[k][1])
    s = [None, None]
    if len(valid) >= 2:
        h0, h1 = valid[:2]
        s = [h0, h1] if d(h0, 0) + d(h1, 1) <= d(h0, 1) + d(h1, 0) else [h1, h0]
    elif valid:
        s[0 if d(valid[0], 0) <= d(valid[0], 1) else 1] = valid[0]
    return s


def extra(H, P, asp):
    """z of each hand (20, relative to the wrist, in hand units) + each fingertip of one hand relative to the other hand's
    palm centre, in units of that hand's size (5 x 2 x 2), + their distances (10)."""
    s = slots_of(H, P, asp)
    out = []
    size = lambda h: math.hypot((h[9][0] - h[0][0]) * asp, h[9][1] - h[0][1]) or 1e-3
    for h in s:
        out += [0.0] * 20 if h is None else [(h[i][2] - h[0][2]) / size(h) * 1.0 for i in range(1, 21)]
    for a, b in ((0, 1), (1, 0)):
        ha, hb = s[a], s[b]
        if ha is None or hb is None:
            out += [0.0] * 15; continue
        c = np.mean([hb[i][:2] for i in (0, 5, 9, 13, 17)], 0); sz = size(hb)
        for t in TIPS:
            dx, dy = (ha[t][0] - c[0]) * asp / sz, (ha[t][1] - c[1]) / sz
            out += [dx, dy, math.hypot(dx, dy)]
    return np.array(out, np.float32)


data = sys.argv[1]
items = load_letters(data)
labels = sorted({it["label"] for it in items}, key=lambda s: (s.isdigit(), s))
X0, X1, Y, G = [], [], [], []
for it in items:
    P = it["pose"][0] if np.isfinite(it["pose"][0][0][0]) else None
    a = anchors(P, it["aspect"])
    if a is None: continue
    hs = [it["hands"][0][j] for j in range(2) if np.isfinite(it["hands"][0][j][0][0])]
    if not hs: continue
    X0.append(frame_features(hs, P, a, it["aspect"])); X1.append(extra(it["hands"][0], P, it["aspect"]))
    Y.append(labels.index(it["label"])); G.append(it["group"])
X0, X1, Y, G = np.array(X0), np.array(X1), np.array(Y), np.array(G)
te = np.array([g.startswith("3.") for g in G]); tr = ~te
for name, X in [("base 96", X0), ("base + z + cross-hand", np.hstack([X0, X1]))]:
    mu, sd = X[tr].mean(0), X[tr].std(0) + 1e-4; Z = (X - mu) / sd
    for mname, m in [("extra trees", ExtraTreesClassifier(500, n_jobs=6, random_state=0)),
                     ("mlp 256-128", MLPClassifier((256, 128), alpha=1e-2, batch_size=256, max_iter=300, early_stopping=True, n_iter_no_change=12, random_state=0))]:
        t = time.time(); m.fit(Z[tr], Y[tr]); acc = (m.predict(Z[te]) == Y[te]).mean()
        print(f"{name:24s} {mname:12s} unseen-signer top1 {acc:.3f} ({time.time() - t:.0f}s)", flush=True)
