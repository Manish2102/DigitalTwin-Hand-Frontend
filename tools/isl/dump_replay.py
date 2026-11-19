"""Dump test videos and letter images (raw landmarks) for an end-to-end replay through js/sign/recognizer.js."""
import json, sys, numpy as np
sys.path.insert(0, ".")
from train import load_words, load_letters
rng = np.random.default_rng(3)
vids = [v for v in load_words(sys.argv[1]) if v["split"] == "test"]
pick = rng.choice(len(vids), 80, replace=False)
nan = lambda a: np.where(np.isfinite(a), np.round(a, 5), None).tolist()
words = [dict(label=vids[i]["label"], hands=nan(vids[i]["hands"]), pose=nan(vids[i]["pose"][:, :, :2])) for i in pick]
lets = [it for it in load_letters(sys.argv[1]) if it["group"].startswith("3.")]
pick = rng.choice(len(lets), 150, replace=False)
letters = [dict(label=lets[i]["label"], aspect=float(lets[i]["aspect"]), hands=nan(lets[i]["hands"][0]), pose=nan(lets[i]["pose"][0][:, :2])) for i in pick]
json.dump(dict(words=words, letters=letters), open(sys.argv[2], "w"))
print(len(words), "videos,", len(letters), "letter images")
