"""Dump the INCLUDE test videos of the presentation phrases (raw landmarks) for replay_phrases.mjs."""
import json, sys, numpy as np
sys.path.insert(0, ".")
from train import load_words
PHRASES = ["Hello", "How are you", "Thank you", "Good Morning", "Good afternoon", "Good evening", "Good night", "Pleased",
           "I", "you", "Friend", "Mother", "Father", "Brother", "Sister", "Today", "Tomorrow"]
nan = lambda a: np.where(np.isfinite(a), np.round(a, 5), None).tolist()
vids = [v for v in load_words(sys.argv[1]) if v["split"] == "test" and v["label"] in PHRASES]
json.dump([dict(label=v["label"], hands=nan(v["hands"]), pose=nan(v["pose"][:, :, :2])) for v in vids], open(sys.argv[2], "w"))
print(len(vids))
