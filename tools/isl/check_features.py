"""Dump a few INCLUDE videos (raw landmarks + Python features) for check_features.mjs."""
import json, sys, numpy as np
sys.path.insert(0, ".")
from features import video_frames, sequence_features
d = np.load(sys.argv[1], allow_pickle=True)
out = []
for i in [0, 7, 30, 60, 99]:
    H, P = d["hands"][i], d["pose"][i]
    fr = video_frames(H, P, 16 / 9)
    seq = sequence_features(fr)
    nan = lambda a: np.where(np.isfinite(a), a, None).tolist()
    out.append({"hands": nan(H[:, :, :, :3]), "pose": nan(P), "frames": [f.tolist() for f in fr], "seq": seq.tolist()})
json.dump(out, open(sys.argv[2], "w"))
print("dumped", len(out))
