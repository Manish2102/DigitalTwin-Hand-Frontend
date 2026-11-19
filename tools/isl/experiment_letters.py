"""Compare classifiers for the letters model on unseen signers (train: kids + teenagers, test: adults)."""
import os, sys, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from train import load_letters, letter_xy
from sklearn.neural_network import MLPClassifier
from sklearn.svm import SVC
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.neighbors import KNeighborsClassifier

data = sys.argv[1]
cache = os.path.join(data, "letters_feat.npz")
items = load_letters(data)
labels = sorted({it["label"] for it in items}, key=lambda s: (s.isdigit(), s))
if os.path.exists(cache):
    z = np.load(cache); Xtr, Ytr, Xtra, Ytra, Xte, Yte = (z[k] for k in ["Xtr", "Ytr", "Xtra", "Ytra", "Xte", "Yte"])
else:
    tr = [it for it in items if not it["group"].startswith("3.")]; te = [it for it in items if it["group"].startswith("3.")]
    Xtr, Ytr = letter_xy(tr, labels, 0); Xtra, Ytra = letter_xy(tr, labels, 4); Xte, Yte = letter_xy(te, labels, 0)
    np.savez(cache, Xtr=Xtr, Ytr=Ytr, Xtra=Xtra, Ytra=Ytra, Xte=Xte, Yte=Yte)
mu, sd = Xtra.mean(0), Xtra.std(0) + 1e-4
S = lambda X: (X - mu) / sd
print("train", Xtr.shape, "aug", Xtra.shape, "test", Xte.shape, flush=True)
models = {
    "mlp 128-64": lambda: MLPClassifier((128, 64), alpha=1e-3, batch_size=512, max_iter=200, early_stopping=True, n_iter_no_change=10, random_state=0),
    "mlp 256-128 strong reg": lambda: MLPClassifier((256, 128), alpha=1e-2, batch_size=512, max_iter=200, early_stopping=True, n_iter_no_change=10, random_state=0),
    "svm rbf": lambda: SVC(C=10, gamma="scale", probability=False),
    "logreg": lambda: LogisticRegression(C=1.0, max_iter=2000),
    "extra trees": lambda: ExtraTreesClassifier(400, n_jobs=4, random_state=0),
    "knn 7": lambda: KNeighborsClassifier(7),
}
for name, mk in models.items():
    for aug, (X, Y) in [("no aug", (Xtr, Ytr)), ("aug x4", (Xtra, Ytra))]:
        if name.startswith("svm") and aug == "aug x4": continue
        t = time.time(); m = mk().fit(S(X), Y); acc = (m.predict(S(Xte)) == Yte).mean()
        print(f"{name:24s} {aug:7s} unseen-signer top1 {acc:.3f}  ({time.time() - t:.0f}s)", flush=True)
