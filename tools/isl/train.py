"""Train the two ISL models and export them for the browser (js/sign/models/*.json).

  words:   isolated ISL word signs from INCLUDE (official train / val / test split by AI4Bharat)
  letters: ISL fingerspelling A-Z and numbers 0-9 from the Mendeley static ISL dataset

    python train.py --data C:/Projects/Digital-Twin/isl-data --out ../../js/sign/models --which words letters

Model: standardised features -> dense(ReLU) -> dense(ReLU) -> softmax (scikit-learn MLP, Adam, early stopping).
Augmentation works on the raw landmarks (mirror for left-handed signers, rotation, scale, noise, missed hands,
trimming), then features are computed exactly as in the browser (features.py == js/sign/features.js).
The confidence threshold is chosen on the validation set so that accepted predictions are right >= TARGET_PRECISION
of the time; below it the app says it is not sure instead of guessing.
"""
import argparse, base64, glob, json, os, re, sys, time
from collections import Counter, defaultdict
import numpy as np
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import confusion_matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from features import FRAME_DIM, SEQ_T, anchors, frame_features, sequence_features, video_frames

TARGET_PRECISION = 0.95
SWAP = list(range(33))
for a, b in [(1, 4), (2, 5), (3, 6), (7, 8), (9, 10), (11, 12), (13, 14), (15, 16), (17, 18), (19, 20), (21, 22), (23, 24), (25, 26), (27, 28), (29, 30), (31, 32)]:
    SWAP[a], SWAP[b] = b, a
rng = np.random.default_rng(11)


def augment(hands, pose, aspect, strong=True):
    """hands (T,2,21,3) pose (T,33,4) in image coords -> augmented copies (same shapes)."""
    H, P = hands.copy(), pose.copy()
    if rng.random() < 0.5:                                          # mirror: a left-handed signer
        H[..., 0] = 1 - H[..., 0]; P[..., 0] = 1 - P[..., 0]; P = P[:, SWAP]
    ang = np.deg2rad(rng.uniform(-10, 10)); sc = rng.uniform(0.9, 1.1)
    cx, cy = 0.5, 0.5
    c, s = np.cos(ang), np.sin(ang)
    for A in (H, P):
        x = (A[..., 0] - cx) * aspect; y = A[..., 1] - cy
        A[..., 0] = (c * x - s * y) * sc / aspect + cx; A[..., 1] = (s * x + c * y) * sc + cy
    H[..., :2] += rng.normal(0, 0.0025, H[..., :2].shape); P[..., :2] += rng.normal(0, 0.003, P[..., :2].shape)
    if strong and len(H) > 6:
        T = len(H)
        a = rng.integers(0, max(1, int(T * 0.12))); b = T - rng.integers(0, max(1, int(T * 0.12)))
        keep = np.arange(a, b); keep = keep[rng.random(len(keep)) > 0.1] if len(keep) > 8 else keep
        H, P = H[keep], P[keep]
        drop = rng.random((len(H), 2)) < 0.07                       # missed detections
        H[drop] = np.nan
    return H, P


# ------------------------------------------------------------------ words
def load_words(data):
    """INCLUDE videos with their word, category and official split. Two quirks of the archives are handled:
    some files are .MP4 while the split lists say .MOV (matched without the extension), and some words have extra
    recordings in a "<word>/Extra/" folder (they belong to that word)."""
    split = {}
    for s in ("train", "val", "test"):
        for line in open(os.path.join(data, "include_meta", f"include_{s}.txt"), encoding="utf-8"):
            if line.strip():
                cat, word, fn = line.strip().split("/")[-3:]
                split[(cat, re.sub(r"^\d+\.\s*", "", word).strip().lower(), os.path.splitext(fn)[0].lower())] = s
    vids = []
    for f in sorted(glob.glob(os.path.join(data, "include", "*.npz"))):
        cat = re.sub(r"_\d+of\d+\.npz$", "", os.path.basename(f))
        d = np.load(f, allow_pickle=True)
        for i in range(len(d["path"])):
            parts = str(d["path"][i]).split("/")
            word = parts[-3] if parts[-2].lower() == "extra" else parts[-2]
            label = re.sub(r"^\d+\.\s*", "", word).strip()
            sp = split.get((cat, label.lower(), os.path.splitext(parts[-1])[0].lower()), "extra")
            vids.append(dict(label=label, split=sp, hands=d["hands"][i].astype(np.float32),
                             pose=d["pose"][i].astype(np.float32), path=str(d["path"][i]), cat=cat))
    return vids


def word_xy(vids, labels, aug=0, aspect=16 / 9):
    X, Y = [], []
    for v in vids:
        for k in range(1 + aug):
            H, P = (v["hands"], v["pose"]) if k == 0 else augment(v["hands"], v["pose"], aspect)
            s = sequence_features(video_frames(H, P, aspect))
            if s is not None:
                X.append(s); Y.append(labels.index(v["label"]))
    return np.array(X, np.float32), np.array(Y)


# ---------------------------------------------------------------- letters
def letter_label(l):
    return {"E1": "E", "E2": "E", "9a": "9", "9b": "9"}.get(l, l)


def load_letters(data):
    d = np.load(os.path.join(data, "static_raw.npz"), allow_pickle=True)
    out = []
    for i in range(len(d["label"])):
        h, w = d["size"][i]
        out.append(dict(label=letter_label(str(d["label"][i])), group=str(d["group"][i]), hands=d["hands"][i][None].astype(np.float32),
                        pose=d["pose"][i][None].astype(np.float32), aspect=w / h))
    return out


def letter_xy(items, labels, aug=0):
    X, Y = [], []
    for it in items:
        for k in range(1 + aug):
            H, P = (it["hands"], it["pose"]) if k == 0 else augment(it["hands"], it["pose"], it["aspect"], strong=False)
            p = P[0] if np.isfinite(P[0][0][0]) else None
            a = anchors(p, it["aspect"])
            if a is None:
                continue
            hs = [H[0][j] for j in range(2) if np.isfinite(H[0][j][0][0])]
            if not hs:
                continue
            X.append(frame_features(hs, p, a, it["aspect"])); Y.append(labels.index(it["label"]))
    return np.array(X, np.float32), np.array(Y)


# ------------------------------------------------------------------ common
def fit(X, Y, hidden, seed=0, alpha=1e-3):
    mu, sd = X.mean(0), X.std(0) + 1e-4
    clf = MLPClassifier(hidden_layer_sizes=hidden, alpha=alpha, batch_size=256, learning_rate_init=1e-3, max_iter=200,
                        early_stopping=True, validation_fraction=0.1, n_iter_no_change=12, random_state=seed)
    clf.fit((X - mu) / sd, Y)
    return clf, mu, sd


def proba(model, X):
    clf, mu, sd = model
    return clf.predict_proba((X - mu) / sd)


def soften(P, T):
    """temperature scaling on probabilities: softmax(log P / T) (same as dividing the logits by T)."""
    L = np.log(np.clip(P, 1e-12, 1)) / T
    L -= L.max(1, keepdims=True); E = np.exp(L)
    return E / E.sum(1, keepdims=True)


def fit_temperature(P, Y):
    """the temperature that makes the probabilities honest on held-out data (lowest log loss)."""
    best = (1.0, 1e9)
    for T in np.concatenate([np.arange(0.5, 3, 0.1), np.arange(3, 20, 0.5)]):
        nll = -np.log(np.clip(soften(P, T)[np.arange(len(Y)), Y], 1e-12, 1)).mean()
        if nll < best[1]: best = (float(T), nll)
    return best[0]


def pick_threshold(P, Y):
    """lowest confidence threshold whose accepted predictions reach TARGET_PRECISION (on held-out data)."""
    conf, pred = P.max(1), P.argmax(1)
    best = (1.0, 0.0, 1.0)
    for t in np.arange(0.2, 0.99, 0.01):
        acc = conf >= t
        if acc.sum() < 5:
            continue
        prec = (pred[acc] == Y[acc]).mean()
        if prec >= TARGET_PRECISION:
            best = (float(t), float(acc.mean()), float(prec)); break
    return best          # threshold, coverage, precision


def report(name, P, Y, labels, thr):
    pred = P.argmax(1); conf = P.max(1)
    top1 = (pred == Y).mean(); top3 = np.mean([y in np.argsort(-p)[:3] for p, y in zip(P, Y)])
    acc = conf >= thr
    cov = acc.mean(); prec = (pred[acc] == Y[acc]).mean() if acc.any() else 0
    cm = confusion_matrix(Y, pred, labels=range(len(labels)))
    np.fill_diagonal(cm, 0)
    pairs = sorted(((cm[i, j], labels[i], labels[j]) for i in range(len(labels)) for j in range(len(labels)) if cm[i, j]), reverse=True)[:8]
    per = {labels[c]: float((pred[Y == c] == c).mean()) for c in range(len(labels)) if (Y == c).any()}
    print(f"[{name}] n={len(Y)} top1={top1:.3f} top3={top3:.3f} | threshold {thr:.2f}: answers {cov:.1%} of signs, "
          f"{prec:.1%} of answers correct | most confused: {', '.join(f'{a}->{b} ({n})' for n, a, b in pairs)}", flush=True)
    return dict(n=int(len(Y)), top1=float(top1), top3=float(top3), coverage=float(cov), precision=float(prec),
                confusions=[[a, b, int(n)] for n, a, b in pairs], per_class=per)


def export(model, labels, thr, path, meta, temperature=1.0):
    clf, mu, sd = model
    b64 = lambda a: base64.b64encode(np.ascontiguousarray(a, np.float32).tobytes()).decode()
    layers = [dict(w=b64(W.T), b=b64(b), rows=int(W.shape[1]), cols=int(W.shape[0])) for W, b in zip(clf.coefs_, clf.intercepts_)]
    json.dump(dict(labels=labels, threshold=round(thr, 3), temperature=round(temperature, 3), mean=b64(mu), std=b64(sd), layers=layers, **meta), open(path, "w"))
    print(f"wrote {path} ({os.path.getsize(path) / 1024:.0f} KB)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--which", nargs="+", default=["letters", "words"]); ap.add_argument("--aug", type=int, default=12); ap.add_argument("--aug-letters", type=int, default=0)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    results = {}

    if "letters" in a.which:
        items = load_letters(a.data)
        labels = sorted({it["label"] for it in items}, key=lambda s: (s.isdigit(), s))
        print(f"letters: {len(items)} images, {len(labels)} classes, groups {Counter(it['group'] for it in items)}", flush=True)
        # 1) unseen signers: train on kids + teenagers, test on adults (different people)
        tr = [it for it in items if not it["group"].startswith("3.")]; te = [it for it in items if it["group"].startswith("3.")]
        Xtr, Ytr = letter_xy(tr, labels, a.aug_letters); Xte, Yte = letter_xy(te, labels, 0)
        m = fit(Xtr, Ytr, (256, 128), alpha=1e-2)
        Pte = proba(m, Xte)
        # threshold from a split of the unseen-signer set, reported on the other half
        idx = rng.permutation(len(Yte)); h = len(idx) // 2
        T = fit_temperature(Pte[idx[:h]], Yte[idx[:h]])
        thr, _, _ = pick_threshold(soften(Pte[idx[:h]], T), Yte[idx[:h]])
        print(f"temperature {T:.2f}, threshold {thr:.2f}", flush=True)
        results["letters_unseen_signers"] = report("letters, unseen signers (adults)", soften(Pte[idx[h:]], T), Yte[idx[h:]], labels, thr)
        # 2) final model on everyone; threshold from the unseen-signer experiment (a conservative choice)
        Xall, Yall = letter_xy(items, labels, a.aug_letters)
        mf = fit(Xall, Yall, (256, 128), alpha=1e-2)
        export(mf, labels, thr, os.path.join(a.out, "letters.json"),
               dict(kind="static", frame_dim=FRAME_DIM, source="Mendeley ISL static gestures, doi 10.17632/7tsw22y96w.1, CC BY 4.0",
                    eval=results["letters_unseen_signers"]), temperature=T)

    if "words" in a.which:
        vids = load_words(a.data)
        labels = sorted({v["label"] for v in vids})
        cats = Counter(v["cat"] for v in vids)
        print(f"words: {len(vids)} videos, {len(labels)} signs, categories {dict(cats)}, splits {Counter(v['split'] for v in vids)}", flush=True)
        t0 = time.time()
        tr = [v for v in vids if v["split"] in ("train", "extra")]; va = [v for v in vids if v["split"] == "val"]; te = [v for v in vids if v["split"] == "test"]
        Xtr, Ytr = word_xy(tr, labels, a.aug); Xva, Yva = word_xy(va, labels); Xte, Yte = word_xy(te, labels)
        print(f"features in {time.time() - t0:.0f}s: train {Xtr.shape}, val {Xva.shape}, test {Xte.shape}", flush=True)
        m = fit(Xtr, Ytr, (256, 128))
        Pva = proba(m, Xva); T = fit_temperature(Pva, Yva)
        thr, cov, prec = pick_threshold(soften(Pva, T), Yva)
        print(f"temperature {T:.2f}, threshold from val: {thr:.2f} (val coverage {cov:.1%}, precision {prec:.1%})", flush=True)
        results["words_test"] = report("words, INCLUDE test split", soften(proba(m, Xte), T), Yte, labels, thr)
        # final: train + val, same threshold
        Xf, Yf = word_xy(tr + va, labels, a.aug)
        mf = fit(Xf, Yf, (256, 128))
        cat_of = {v["label"]: v["cat"] for v in vids}
        export(mf, labels, thr, os.path.join(a.out, "words.json"),
               dict(kind="sequence", frame_dim=FRAME_DIM, seq_t=SEQ_T, categories={l: cat_of[l] for l in labels},
                    source="INCLUDE (AI4Bharat, IIT Madras), zenodo.org/records/4010759, CC BY 4.0", eval=results["words_test"]), temperature=T)
    json.dump(results, open(os.path.join(a.out, "..", "..", "..", "tools", "isl", "results.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
