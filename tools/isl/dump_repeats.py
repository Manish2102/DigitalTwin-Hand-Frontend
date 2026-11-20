"""Simulate one person repeating a sign: augmented copies (noise, small rotation / scale / trimming) of ONE test recording."""
import json, sys, numpy as np
sys.path.insert(0, ".")
from train import load_words, augment
nan = lambda a: np.where(np.isfinite(a), np.round(a, 5), None).tolist()
v = [x for x in load_words(sys.argv[1]) if x["split"] == "test" and x["label"] == sys.argv[3]][0]
rng = np.random.default_rng(9)
def repeat(hands, pose, aspect=16 / 9):
    """The same person signing again: small noise, tiny rotation / scale / shift; no mirroring and no hand swap."""
    H, P = hands.copy(), pose.copy()
    ang = np.deg2rad(rng.uniform(-4, 4)); sc = rng.uniform(0.96, 1.04); c, s = np.cos(ang), np.sin(ang)
    for A in (H, P):
        x = (A[..., 0] - 0.5) * aspect; y = A[..., 1] - 0.5
        A[..., 0] = (c * x - s * y) * sc / aspect + 0.5 + rng.normal(0, 0.01); A[..., 1] = (s * x + c * y) * sc + 0.5 + rng.normal(0, 0.01)
    H[..., :2] += rng.normal(0, 0.003, H[..., :2].shape); P[..., :2] += rng.normal(0, 0.003, P[..., :2].shape)
    return H, P
copies = []
for _ in range(8):
    H, P = repeat(v["hands"], v["pose"])
    copies.append(dict(label=sys.argv[3], hands=nan(H), pose=nan(P[:, :, :2])))
json.dump(copies, open(sys.argv[2], "w")); print(len(copies))
