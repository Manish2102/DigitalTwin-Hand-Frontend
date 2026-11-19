"""Build the ISL reference (docs/isl-reference.md, docs/isl/*.svg, docs/isl/index.json) from the training data.

Every illustration and description is computed from real ISL signers in the datasets (nothing is drawn by hand):
for each sign the most typical recording (the medoid: closest to the average of that sign's recordings) is drawn
as a skeleton, and its description is measured from the same landmarks (hands used, hand shape, where the sign is
made, direction of movement, repetition).

    python make_reference.py --data C:/Projects/Digital-Twin/isl-data --docs ../../docs --models ../../js/sign/models
"""
import argparse, json, math, os, re, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from features import anchors, video_frames, sequence_features, is_active
from train import load_words, load_letters, letter_xy

BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]]
FINGERS = {"thumb": (4, 3, 2), "index": (8, 6, 5), "middle": (12, 10, 9), "ring": (16, 14, 13), "little": (20, 18, 17)}
slug = lambda s: re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


# ------------------------------------------------------------- measuring
def extended(h, asp):
    """which fingers are straight: tip farther from the wrist than the middle joint (thumb: from the index knuckle)."""
    d = lambda i, j: math.hypot((h[i][0] - h[j][0]) * asp, h[i][1] - h[j][1])
    out = []
    for name, (tip, pip, mcp) in FINGERS.items():
        if name == "thumb":
            if d(4, 5) > d(3, 5) * 1.15 and d(4, 9) > d(2, 9) * 0.9: out.append(name)
        elif d(tip, 0) > d(pip, 0) * 1.1:
            out.append(name)
    return out


def shape_name(ext):
    s = set(ext)
    if not s: return "closed fist"
    if s == {"thumb"}: return "fist with the thumb out"
    if len(s) == 5: return "open flat hand"
    if s == {"index", "middle", "ring", "little"}: return "flat hand, thumb folded"
    if s == {"index"}: return "index finger pointing"
    if s == {"index", "thumb"}: return "L shape (thumb and index)"
    if s == {"index", "middle"}: return "index and middle finger (V)"
    if s == {"little"}: return "little finger raised"
    if s == {"thumb", "little"}: return "thumb and little finger out (Y)"
    order = ["thumb", "index", "middle", "ring", "little"]
    return " and ".join(f for f in order if f in s) + " extended"


def location(y):
    return "near the face" if y < -0.55 else "at chest level" if y < 0.55 else "at waist level"


def body_pts(P, H, asp):
    """image -> body units for a frame: pose (33,2) and hands list of (21,2) in body coords."""
    a = anchors(P, asp)
    if a is None: return None
    tb = lambda p: (((p[0] - a[0]) * asp) / a[2], (p[1] - a[1]) / a[2])
    return a, [tb(p) for p in P[:25]], [[tb(p) for p in h] for h in H]


def assign(Hs, P, asp):
    """same slot rule as the features: slot 0 = signer's right (pose 16)."""
    valid = [h for h in Hs if np.isfinite(h[0][0])]
    slots = [None, None]
    if not valid: return slots
    wr = [P[16], P[15]]
    d = lambda h, k: math.hypot((h[0][0] - wr[k][0]) * asp, h[0][1] - wr[k][1])
    if len(valid) >= 2:
        h0, h1 = valid[:2]
        slots = [h0, h1] if d(h0, 0) + d(h1, 1) <= d(h0, 1) + d(h1, 0) else [h1, h0]
    else:
        slots[0 if d(valid[0], 0) <= d(valid[0], 1) else 1] = valid[0]
    return slots


def describe_static(H, P, asp):
    slots = assign([H[0][0], H[0][1]], P[0], asp)
    a = anchors(P[0], asp)
    slots = [h if h is not None and (h[0][1] - a[1]) / a[2] < 1.1 else None for h in slots]   # a hand at the waist is resting
    parts, hands = [], [s for s in slots if s is not None]
    parts.append("Two hands." if len(hands) == 2 else "One hand.")
    for name, h in zip(["Right hand", "Left hand"], slots):
        if h is None: continue
        y = (h[0][1] - a[1]) / a[2]
        parts.append(f"{name}: {shape_name(extended(h, asp))}, {location(y)}.")
    if len(hands) == 2:
        gap = math.hypot((hands[0][9][0] - hands[1][9][0]) * asp, hands[0][9][1] - hands[1][9][1]) / a[2]
        if gap < 0.25: parts.append("The hands touch or overlap.")
    return " ".join(parts)


def describe_word(H, P, asp):
    rows = []
    for t in range(len(H)):
        if not np.isfinite(P[t][0][0]): continue
        a = anchors(P[t], asp)
        if a is None: continue
        rows.append((t, a, assign([H[t][0], H[t][1]], P[t], asp)))
    act = [r for r in rows if any(s is not None and (s[0][1] - r[1][1]) / r[1][2] < 1.25 for s in r[2])]
    if len(act) < 3: return "Movement too short to describe."
    raised = lambda r, k: r[2][k] is not None and (r[2][k][0][1] - r[1][1]) / r[1][2] < 1.25
    use = [sum(1 for r in act if raised(r, k)) / len(act) for k in range(2)]
    two = use[0] > 0.4 and use[1] > 0.4
    parts = ["Two hands." if two else ("One hand (the signer's right); the other hand rests." if use[0] >= use[1] else "One hand (the signer's left); the other hand rests.")]
    for k, name in enumerate(["Right hand", "Left hand"]):
        if use[k] <= 0.4: continue
        rows_k = [r for r in act if raised(r, k)]
        tr = [((r[2][k][0][0] - r[1][0]) * asp / r[1][2], (r[2][k][0][1] - r[1][1]) / r[1][2]) for r in rows_k]
        mid = rows_k[len(rows_k) // 2]
        shape = shape_name(extended(mid[2][k], asp))
        ys = [p[1] for p in tr]; xs = [p[0] for p in tr]
        dx, dy = xs[-1] - xs[0], ys[-1] - ys[0]
        path = sum(math.hypot(xs[i + 1] - xs[i], ys[i + 1] - ys[i]) for i in range(len(xs) - 1))
        moves = []
        if abs(dx) > 0.25: moves.append("towards the signer's " + ("left" if dx > 0 else "right"))   # body x grows to the signer's left
        if abs(dy) > 0.25: moves.append("downwards" if dy > 0 else "upwards")
        rev = sum(1 for i in range(1, len(xs) - 1) if (xs[i] - xs[i - 1]) * (xs[i + 1] - xs[i]) < 0 and abs(xs[i + 1] - xs[i]) > 0.03)
        rev += sum(1 for i in range(1, len(ys) - 1) if (ys[i] - ys[i - 1]) * (ys[i + 1] - ys[i]) < 0 and abs(ys[i + 1] - ys[i]) > 0.03)
        mv = ("moves " + " and ".join(moves)) if moves else ("stays in place" if path < 0.6 else "moves and comes back")
        rep = ", repeated" if rev >= 4 and path > 1.0 else ""
        parts.append(f"{name}: {shape}, {location(float(np.median(ys)))}, {mv}{rep}.")
    return " ".join(parts)


# ---------------------------------------------------------------- drawing
def svg_frame(P, slots, asp, ox, color_r="#4361e8", color_l="#c27a00", scale=46, cy=70):
    """one skeleton (seen facing the signer, so the signer's right hand is on the left of the picture)."""
    a = anchors(P, asp)
    if a is None: return ""
    X = lambda p: ox + ((p[0] - a[0]) * asp / a[2]) * scale
    Y = lambda p: cy + ((p[1] - a[1]) / a[2]) * scale
    g = []
    nose = P[0]
    g.append(f'<circle cx="{X(nose):.1f}" cy="{Y(nose) - 4:.1f}" r="{0.42 * scale:.1f}" fill="none" stroke="#9aa3ae" stroke-width="2"/>')
    for i, j in [(11, 12), (11, 13), (13, 15), (12, 14), (14, 16), (11, 23), (12, 24)]:
        if np.isfinite(P[i][0]) and np.isfinite(P[j][0]) and (j < 23 or P[j][1] < 1.2):
            g.append(f'<line x1="{X(P[i]):.1f}" y1="{Y(P[i]):.1f}" x2="{X(P[j]):.1f}" y2="{Y(P[j]):.1f}" stroke="#9aa3ae" stroke-width="3" stroke-linecap="round"/>')
    for h, col in zip(slots, (color_r, color_l)):
        if h is None: continue
        if (h[0][1] - a[1]) / a[2] > 1.25: col = "#c4c9d0"                 # resting, not part of the sign
        for i, j in BONES:
            g.append(f'<line x1="{X(h[i]):.1f}" y1="{Y(h[i]):.1f}" x2="{X(h[j]):.1f}" y2="{Y(h[j]):.1f}" stroke="{col}" stroke-width="2.2" stroke-linecap="round"/>')
        for k in (4, 8, 12, 16, 20):
            g.append(f'<circle cx="{X(h[k]):.1f}" cy="{Y(h[k]):.1f}" r="2.2" fill="{col}"/>')
    return "".join(g)


def svg_wrap(body, w, h, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{title}">'
            f'<rect width="{w}" height="{h}" rx="10" fill="#ffffff"/>{body}</svg>')


def static_svg(it):
    P, asp = it["pose"][0], it["aspect"]
    slots = assign([it["hands"][0][0], it["hands"][0][1]], P, asp)
    body = svg_frame(P, slots, asp, 105, scale=58, cy=74)
    # enlarged view of the hands that are raised
    a = anchors(P, asp)
    hs = [(h, c) for h, c in zip(slots, ("#4361e8", "#c27a00")) if h is not None and (h[0][1] - a[1]) / a[2] < 1.1]
    if hs:
        pts = np.array([[p[0] * asp, p[1]] for h, _ in hs for p in h])
        lo, hi = pts.min(0), pts.max(0); span = max(hi - lo) or 1e-3
        k = 170 / span; cx, cy = (lo + hi) / 2
        g = ['<rect x="225" y="10" width="190" height="190" rx="8" fill="#f6f7f9"/>']
        for h, col in hs:
            for i, j in BONES:
                x1, y1 = 320 + (h[i][0] * asp - cx) * k, 105 + (h[i][1] - cy) * k
                x2, y2 = 320 + (h[j][0] * asp - cx) * k, 105 + (h[j][1] - cy) * k
                g.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{col}" stroke-width="3" stroke-linecap="round"/>')
            for t in (4, 8, 12, 16, 20):
                g.append(f'<circle cx="{320 + (h[t][0] * asp - cx) * k:.1f}" cy="{105 + (h[t][1] - cy) * k:.1f}" r="3.5" fill="{col}"/>')
        body += "".join(g)
    return svg_wrap(body, 425, 210, it["label"])


def word_svg(v, label):
    H, P, asp = v["hands"], v["pose"], 16 / 9
    fr = video_frames(H, P, asp)
    idx = [t for t, f in enumerate(fr) if is_active(f)]
    if len(idx) < 3: idx = list(range(len(fr)))
    keys = [idx[0], idx[len(idx) // 2], idx[-1]]
    parts, labels = [], ["start", "middle", "end"]
    for n, t in enumerate(keys):
        if not np.isfinite(P[t][0][0]): continue
        slots = assign([H[t][0], H[t][1]], P[t], asp)
        ox = 95 + n * 190
        parts.append(svg_frame(P[t], slots, asp, ox, scale=44, cy=78))
        parts.append(f'<text x="{ox}" y="196" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="12" fill="#6b7280">{labels[n]}</text>')
    # wrist paths over the whole active part, drawn on the middle figure
    a = anchors(P[keys[1]], asp)
    if a is not None:
        for k, col in ((0, "#4361e8"), (1, "#c27a00")):
            pts = []
            for t in idx:
                if not np.isfinite(P[t][0][0]): continue
                s = assign([H[t][0], H[t][1]], P[t], asp)[k]
                at = anchors(P[t], asp)
                if s is None or at is None: continue
                pts.append((285 + ((s[0][0] - at[0]) * asp / at[2]) * 44, 78 + ((s[0][1] - at[1]) / at[2]) * 44))
            if len(pts) > 2:
                d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
                parts.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="2" stroke-dasharray="4 3" opacity=".8"/>')
                (x1, y1), (x0, y0) = pts[-1], pts[-2]
                ang = math.atan2(y1 - y0, x1 - x0)
                for s in (-0.5, 0.5):
                    parts.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x1 - 9 * math.cos(ang + s):.1f}" y2="{y1 - 9 * math.sin(ang + s):.1f}" stroke="{col}" stroke-width="2"/>')
    return svg_wrap("".join(parts), 570, 210, label)


def medoid(X):
    c = X.mean(0)
    return int(np.argmin(((X - c) ** 2).sum(1)))


# ------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True); ap.add_argument("--docs", required=True); ap.add_argument("--models", required=True)
    a = ap.parse_args()
    out = os.path.join(a.docs, "isl"); os.makedirs(out, exist_ok=True)
    wm = json.load(open(os.path.join(a.models, "words.json"))); lm = json.load(open(os.path.join(a.models, "letters.json")))
    index = {"letters": [], "words": []}

    items = load_letters(a.data)
    for lab in lm["labels"]:
        its = [it for it in items if it["label"] == lab]
        X, keep = [], []
        for it in its:
            x, _ = letter_xy([it], lm["labels"], 0)
            if len(x): X.append(x[0]); keep.append(it)
        if not keep: continue
        it = keep[medoid(np.array(X))]
        fn = f"letter-{slug(lab)}.svg"
        open(os.path.join(out, fn), "w").write(static_svg(it))
        acc = lm["eval"]["per_class"].get(lab)
        index["letters"].append(dict(label=lab, svg=f"isl/{fn}", text=describe_static(it["hands"], it["pose"], it["aspect"]),
                                     samples=len(its), accuracy=acc))

    vids = load_words(a.data)
    for lab in wm["labels"]:
        vs = [v for v in vids if v["label"] == lab and v["split"] != "test"]
        X, keep = [], []
        for v in vs:
            s = sequence_features(video_frames(v["hands"], v["pose"], 16 / 9))
            if s is not None: X.append(s); keep.append(v)
        if not keep: continue
        v = keep[medoid(np.array(X))]
        fn = f"word-{slug(lab)}.svg"
        open(os.path.join(out, fn), "w").write(word_svg(v, lab))
        index["words"].append(dict(label=lab, category=wm["categories"][lab].replace("_", " "), svg=f"isl/{fn}",
                                   text=describe_word(v["hands"], v["pose"], 16 / 9), samples=len([x for x in vids if x["label"] == lab]),
                                   accuracy=wm["eval"]["per_class"].get(lab)))
    json.dump(index, open(os.path.join(out, "index.json"), "w"), indent=1)
    print(f"{len(index['letters'])} letter and {len(index['words'])} word illustrations in {out}")


if __name__ == "__main__":
    main()
